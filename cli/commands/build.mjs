import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, listFlag } from '../lib/args.mjs';
import { paths, ensureDir } from '../lib/paths.mjs';
import { starter } from '../lib/config.mjs';
import { resolveMatrix, selectTargets } from '../lib/matrix.mjs';
import { assertDocker, compose, syncCompose } from '../lib/docker.mjs';
import { ensureUp } from '../lib/runner.mjs';
import { run } from '../lib/proc.mjs';
import { log, c, UserError } from '../lib/log.mjs';

/** Reads the Version header of a plugin file. */
function pluginVersion( dir ) {
	const file = path.join( paths.plugins, dir, `${ dir }.php` );

	if ( ! fs.existsSync( file ) ) {
		throw new UserError( `Plugin file not found: ${ file }` );
	}

	const header = fs.readFileSync( file, 'utf8' ).slice( 0, 4096 );
	const match = header.match( /^\s*\*\s*Version:\s*(.+)$/m );

	if ( ! match ) {
		throw new UserError( `No "Version:" header in ${ file }` );
	}

	return match[ 1 ].trim();
}

/** Builds the editor assets on the host (Node is here, PHP is not). */
async function buildAssets( dir ) {
	const pkgFile = path.join( paths.plugins, dir, 'package.json' );

	if ( ! fs.existsSync( pkgFile ) ) return true;

	const pkg = JSON.parse( fs.readFileSync( pkgFile, 'utf8' ) );

	if ( ! pkg.scripts?.build ) return true;

	const cwd = path.join( paths.plugins, dir );

	if ( ! fs.existsSync( path.join( cwd, 'node_modules' ) ) ) {
		log.step( `${ dir }: npm install` );
		const install = await run( 'npm', [ 'install', '--no-audit', '--no-fund' ], { cwd } );
		if ( install.code !== 0 ) return false;
	}

	log.step( `${ dir }: npm run build` );
	const { code } = await run( 'npm', [ 'run', 'build' ], { cwd } );

	return code === 0;
}

/**
 * Assembles the distributable inside a container: only there is PHP available, and only there can
 * `composer install --no-dev` produce the exact autoloader that ships to users.
 */
async function packagePlugin( target, dir, version, onLog ) {
	const stage = `/wplab/build/${ dir }`;
	const source = `/var/www/html/wp-content/plugins/${ dir }`;

	const script = [
		`set -e`,
		`rm -rf ${ stage } && mkdir -p ${ stage }`,
		// .distignore is the single source of truth for what never ships.
		`rsync -a --delete --exclude-from=${ source }/.distignore --exclude='.git' ${ source }/ ${ stage }/`,
		`if [ -f ${ stage }/composer.json ] || [ -f ${ source }/composer.json ]; then ` +
			`cp ${ source }/composer.json ${ stage }/composer.json 2>/dev/null || true; ` +
			`[ -f ${ source }/composer.lock ] && cp ${ source }/composer.lock ${ stage }/ || true; ` +
			`composer install --working-dir=${ stage } --no-dev --optimize-autoloader --no-interaction --quiet || true; ` +
			`rm -f ${ stage }/composer.json ${ stage }/composer.lock; fi`,
		// A plugin without third-party libraries should not ship an empty vendor/ directory.
		`if [ -d ${ stage }/vendor ] && [ -z "$(ls -A ${ stage }/vendor 2>/dev/null)" ]; then rm -rf ${ stage }/vendor; fi`,
		`rm -rf /wplab/build/${ dir }-${ version }.zip`,
		`cd /wplab/build && zip -rq ${ dir }-${ version }.zip ${ dir } -x '*.DS_Store'`,
		`echo "packaged ${ dir }-${ version }.zip"`,
	].join( ' && ' );

	const { code } = await compose(
		[ 'exec', '-T', target.service, 'bash', '-lc', script ],
		{ onData: onLog }
	);

	return code === 0;
}

export async function run_build( argv ) {
	const { flags } = parseArgs( argv, { booleans: [ 'skip-assets' ] } );
	await assertDocker();

	const s = starter();
	const matrix = await resolveMatrix();
	syncCompose( matrix );

	const editions = listFlag( flags.edition ).length
		? listFlag( flags.edition )
		: [ 'free', 'pro' ];

	const wanted = ( editions.includes( 'both' ) ? [ 'free', 'pro' ] : editions ).filter(
		( edition ) => s.editions?.[ edition ]?.enabled && s.editions[ edition ].dir
	);

	if ( ! wanted.length ) {
		throw new UserError( 'No edition to build - check starter.json -> editions.' );
	}

	// Packaging happens in the newest target so the shipped autoloader matches modern PHP.
	const [ target ] = selectTargets( matrix, [ flags.target || matrix.targets[ 0 ].id ] );
	const ready = await ensureUp( matrix, [ target ], { onLog: ( t ) => process.stdout.write( t ) } );

	if ( ! ready ) return 1;

	ensureDir( path.join( paths.root, 'dist' ) );
	const built = [];

	for ( const edition of wanted ) {
		const dir = s.editions[ edition ].dir;
		const version = pluginVersion( dir );

		if ( ! flags[ 'skip-assets' ] && ! ( await buildAssets( dir ) ) ) {
			log.fail( `${ dir }: asset build failed` );
			return 1;
		}

		log.step( `${ dir }: packaging ${ version }` );

		if ( ! ( await packagePlugin( target, dir, version, ( t ) => process.stdout.write( t ) ) ) ) {
			log.fail( `${ dir }: packaging failed` );
			return 1;
		}

		const zipName = `${ dir }-${ version }.zip`;
		const from = path.join( paths.work, 'build', zipName );
		const to = path.join( paths.root, 'dist', zipName );

		fs.copyFileSync( from, to );
		built.push( { zipName, to, size: fs.statSync( to ).size } );
	}

	log.blank();

	for ( const item of built ) {
		log.ok(
			`${ path.relative( paths.root, item.to ) }  ${ c.dim(
				`${ Math.round( item.size / 1024 ) } KB`
			) }`
		);
	}

	log.blank();

	return 0;
}

export { run_build as run };
