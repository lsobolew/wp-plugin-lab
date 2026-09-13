import fs from 'node:fs';
import path from 'node:path';
import { paths, ensureDir } from './paths.mjs';
import { pluginDirs, pluginsForEdition, starter } from './config.mjs';
import { compose, serviceStatus, syncCompose, withProfiles } from './docker.mjs';
import { waitForHealthy } from './health.mjs';
import { resultFile, writeSyntheticResult, readSummary } from './junit.mjs';
import { log, c } from './log.mjs';

export const SUITES = [ 'unit', 'integration', 'e2e', 'lint', 'analyse', 'plugin-check' ];

/** Plugin directory inside the container. */
const containerPluginPath = ( dir ) => `/var/www/html/wp-content/plugins/${ dir }`;

/** Editions that can actually run (pro only when its directory exists). */
export function availableEditions() {
	const dirs = pluginDirs();
	const out = [ 'free' ];
	if ( dirs.some( ( p ) => p.edition === 'pro' ) ) out.push( 'pro' );
	return out;
}

export function resolveEditions( flag ) {
	const available = availableEditions();
	if ( ! flag || flag === 'both' || flag === 'all' ) return available;
	const wanted = String( flag ).split( ',' ).map( ( s ) => s.trim() );
	return wanted.filter( ( e ) => available.includes( e ) );
}

/** Starts a target when it is not running yet. */
export async function ensureUp( matrix, targets, { onLog } = {} ) {
	const status = await serviceStatus();
	const missing = targets.filter( ( t ) => {
		const row = status[ t.service ];
		return ! row || ( row.State || '' ).toLowerCase() !== 'running';
	} );

	if ( ! missing.length ) return true;

	onLog?.( `Starting environments: ${ missing.map( ( t ) => t.id ).join( ', ' ) }\n` );
	syncCompose( matrix );
	await compose( withProfiles( missing, [ 'up', '-d', ...missing.map( ( t ) => t.service ) ] ), {
		onData: onLog ? ( chunk ) => onLog( chunk ) : undefined,
	} );

	return waitForHealthy( missing );
}

/**
 * Puts the plugins into the state a given edition expects: free = the free plugin only,
 * pro = free plus the add-on. Done before every run, because the previous one may have left
 * a different state behind.
 */
export async function applyEdition( target, edition, { onLog } = {} ) {
	const all = pluginDirs().map( ( p ) => p.dir );
	const wanted = pluginsForEdition( edition );
	const unwanted = all.filter( ( dir ) => ! wanted.includes( dir ) );

	const commands = [];
	if ( unwanted.length ) {
		commands.push( `wp --allow-root plugin deactivate ${ unwanted.join( ' ' ) } || true` );
	}
	if ( wanted.length ) {
		commands.push( `wp --allow-root plugin activate ${ wanted.join( ' ' ) }` );
	}

	if ( ! commands.length ) return true;

	const { code } = await compose(
		[ 'exec', '-T', target.service, 'bash', '-lc', commands.join( ' && ' ) ],
		{ onData: onLog ? ( chunk ) => onLog( chunk ) : undefined }
	);
	return code === 0;
}

/**
 * The packages (plugin directories) exercised for a given edition.
 *
 * The free edition tests the free plugin only. The pro edition runs both suites: the core with the
 * add-on active (to catch regressions) and the add-on's own tests. The key becomes part of the
 * result file name, so the dashboard shows exactly which suite failed.
 */
export function packagesForEdition( edition ) {
	const s = starter();
	const freeDir = s.editions?.free?.dir || 'my-plugin';
	const proDir = s.editions?.pro?.dir || 'my-plugin-pro';

	if ( edition !== 'pro' ) {
		return [ { dir: freeDir, key: 'free', vendorFrom: freeDir } ];
	}

	return [
		{ dir: freeDir, key: 'pro', vendorFrom: freeDir },
		{ dir: proDir, key: 'proaddon', vendorFrom: freeDir },
	];
}

/**
 * Every existing package - for suites that do not depend on the edition (unit tests never load
 * WordPress, and the linters look at code rather than at site state).
 */
export function allPackages() {
	const s = starter();
	const freeDir = s.editions?.free?.dir || 'my-plugin';
	const packages = [ { dir: freeDir, key: 'free', vendorFrom: freeDir } ];

	if ( availableEditions().includes( 'pro' ) ) {
		packages.push( {
			dir: s.editions?.pro?.dir || 'my-plugin-pro',
			key: 'proaddon',
			vendorFrom: freeDir,
		} );
	}

	return packages;
}

/** Builds the PHPUnit command for a suite. */
function phpunitCommand( { pluginDir, vendorFrom, suite, junitPath, filter, coverage } ) {
	const config = suite === 'unit' ? 'phpunit-unit.xml.dist' : 'phpunit-integration.xml.dist';
	// The add-on has no vendor/ of its own - reach for the PHPUnit from the free plugin.
	const binary =
		pluginDir === vendorFrom
			? 'vendor/bin/phpunit'
			: `${ containerPluginPath( vendorFrom ) }/vendor/bin/phpunit`;
	const args = [
		binary,
		'-c',
		config,
		'--log-junit',
		junitPath,
		'--colors=always',
	];
	if ( filter ) args.push( '--filter', JSON.stringify( filter ) );
	if ( coverage ) args.push( '--coverage-text' );

	const prefix = coverage ? 'XDEBUG_MODE=coverage ' : '';
	return `cd ${ containerPluginPath( pluginDir ) } && ${ prefix }${ args.join( ' ' ) }`;
}

/**
 * Runs one suite, on one target, in one edition.
 *
 * @return {Promise<{ok: boolean, file: string|null}>}
 */
export async function runSuite( {
	matrix,
	target,
	suite,
	edition,
	pkg,
	filter,
	coverage,
	onLog,
} ) {
	ensureDir( paths.results );
	const s = starter();
	const freeDir = s.editions?.free?.dir || 'my-plugin';
	const proDir = s.editions?.pro?.dir || 'my-plugin-pro';
	const emit = ( text ) => onLog?.( text );

	// The results directory is mounted at /wplab, so the container writes straight to the host.
	const label = [ target.id, pkg?.key ?? edition, suite ].filter( Boolean ).join( '-' );
	const junitHost = resultFile( { target: target.id, edition: pkg?.key ?? edition, suite } );
	const junitContainer = `/wplab/results/${ path.basename( junitHost ) }`;

	emit( `\n${ '='.repeat( 60 ) }\n${ label } (WP ${ target.wpVersion } / PHP ${ target.php })\n${ '='.repeat( 60 ) }\n` );

	if ( suite === 'unit' || suite === 'integration' ) {
		const ready = await ensureUp( matrix, [ target ], { onLog: emit } );
		if ( ! ready ) return { ok: false, file: null };

		if ( suite === 'integration' ) {
			await applyEdition( target, edition, { onLog: emit } );
			const install = await compose(
				[ 'exec', '-T', target.service, 'bash', '-lc', '/usr/local/wplab/install-test-suite.sh' ],
				{ onData: emit }
			);
			if ( install.code !== 0 ) return { ok: false, file: null };
		}

		const { code } = await compose(
			[
				'exec',
				'-T',
				'-e',
				`WPLAB_EDITION=${ edition }`,
				'-e',
				`WPLAB_FREE_DIR=${ freeDir }`,
				'-e',
				`WPLAB_PRO_DIR=${ proDir }`,
				target.service,
				'bash',
				'-lc',
				phpunitCommand( {
					pluginDir: pkg.dir,
					vendorFrom: pkg.vendorFrom,
					suite,
					junitPath: junitContainer,
					filter,
					coverage,
				} ),
			],
			{ onData: emit }
		);

		return { ok: code === 0, file: junitHost };
	}

	if ( suite === 'plugin-check' ) {
		const ready = await ensureUp( matrix, [ target ], { onLog: emit } );
		if ( ! ready ) return { ok: false, file: null };

		// Plugin Check is the same tool the WordPress.org review team runs, so failing it here
		// means the submission would be rejected there.
		const script = [
			'wp --allow-root plugin is-installed plugin-check',
			'|| wp --allow-root plugin install plugin-check --activate',
			'; wp --allow-root plugin activate plugin-check',
			// Dev-only directories never ship in the zip, so checking them only produces noise.
			`; wp --allow-root plugin check ${ pkg.dir } --format=table --severity=5` +
				' --exclude-directories=tests,vendor,node_modules,assets,build',
		].join( ' ' );

		let output = '';
		const { code } = await compose( [ 'exec', '-T', target.service, 'bash', '-lc', script ], {
			onData: ( chunk ) => {
				output += chunk;
				emit( chunk );
			},
		} );

		const file = writeSyntheticResult( {
			target: target.id,
			edition: pkg.key,
			suite,
			passed: code === 0,
			output,
		} );

		return { ok: code === 0, file };
	}

	if ( suite === 'lint' || suite === 'analyse' ) {
		const ready = await ensureUp( matrix, [ target ], { onLog: emit } );
		if ( ! ready ) return { ok: false, file: null };

		// The add-on has no vendor/ of its own, so the tools come from the free plugin.
		const bin = `${ containerPluginPath( pkg.vendorFrom ) }/vendor/bin`;
		const script =
			suite === 'lint'
				? `cd ${ containerPluginPath( pkg.dir ) } && ${ bin }/phpcs --report=full --colors`
				: `cd ${ containerPluginPath( pkg.dir ) } && ${ bin }/phpstan analyse --memory-limit=1G --no-progress`;

		let output = '';
		const { code } = await compose( [ 'exec', '-T', target.service, 'bash', '-lc', script ], {
			onData: ( chunk ) => {
				output += chunk;
				emit( chunk );
			},
		} );

		const file = writeSyntheticResult( {
			target: target.id,
			edition: pkg.key,
			suite,
			passed: code === 0,
			output,
		} );

		return { ok: code === 0, file };
	}

	throw new Error( `Nieobslugiwany suite: ${ suite }` );
}

/** Prints the summary table at the end of a run. */
export function printSummary( rows ) {
	log.blank();
	log.info( c.bold( 'Summary' ) );

	for ( const row of rows ) {
		const summary = row.file ? readSummary( row.file ) : null;
		const counts = summary
			? `${ summary.tests } tests, ${ summary.failures + summary.errors } failed`
			: 'no results';
		const status = row.ok ? c.green( 'OK  ' ) : c.red( 'FAIL' );
		log.info( `  ${ status } ${ row.label.padEnd( 28 ) } ${ c.dim( counts ) }` );
	}

	const failed = rows.filter( ( r ) => ! r.ok ).length;
	log.blank();
	if ( failed ) {
		log.fail( `Failed runs: ${ failed } of ${ rows.length }` );
	} else {
		log.ok( `All runs green (${ rows.length })` );
	}
	return failed === 0 ? 0 : 1;
}

export { readSummary };
