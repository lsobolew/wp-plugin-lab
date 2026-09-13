import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { parseArgs } from '../lib/args.mjs';
import { paths, readJson, writeJson } from '../lib/paths.mjs';
import { starter, resetConfigCache } from '../lib/config.mjs';
import { log, c, UserError } from '../lib/log.mjs';

/** Directories that are never rewritten: generated, vendored or not ours. */
const SKIP_DIRS = new Set( [
	'node_modules',
	'vendor',
	'build',
	'.git',
	'.wplab',
	'dist',
	'playwright-report',
	'skills',
] );

const TEXT_EXTENSIONS = new Set( [
	'.php',
	'.js',
	'.mjs',
	'.json',
	'.txt',
	'.md',
	'.scss',
	'.css',
	'.yml',
	'.yaml',
	'.xml',
	'.dist',
	'.neon',
	'.sh',
	'.html',
] );

const slugToNamespace = ( slug ) =>
	slug
		.split( /[-_]/ )
		.filter( Boolean )
		.map( ( part ) => part.charAt( 0 ).toUpperCase() + part.slice( 1 ) )
		.join( '' );

const slugToTitle = ( slug ) =>
	slug
		.split( /[-_]/ )
		.filter( Boolean )
		.map( ( part ) => part.charAt( 0 ).toUpperCase() + part.slice( 1 ) )
		.join( ' ' );

function validate( answers ) {
	if ( ! /^[a-z][a-z0-9-]*$/.test( answers.slug ) ) {
		throw new UserError(
			`"${ answers.slug }" is not a valid plugin slug (lowercase letters, digits and dashes).`
		);
	}

	if ( answers.slug.endsWith( '-pro' ) ) {
		throw new UserError(
			'The slug must not end with "-pro" - that suffix is reserved for the paid edition.'
		);
	}

	if ( ! /^[A-Za-z][A-Za-z0-9]*\\[A-Za-z][A-Za-z0-9]*$/.test( answers.namespace ) ) {
		throw new UserError(
			`"${ answers.namespace }" should look like Vendor\\PluginName.`
		);
	}
}

/**
 * Every rename in one ordered list. Order matters: the "-pro" variants have to run before the
 * base ones, otherwise "my-plugin-pro" would first become "<slug>-pro" and then be rewritten again.
 */
function replacements( from, to ) {
	const pairs = [
		[ `${ from.namespace.replace( /\\/g, '\\\\' ) }Pro`, `${ to.namespace.replace( /\\/g, '\\\\' ) }Pro` ],
		[ `${ from.namespace }Pro`, `${ to.namespace }Pro` ],
		[ from.namespace.replace( /\\/g, '\\\\' ), to.namespace.replace( /\\/g, '\\\\' ) ],
		[ from.namespace, to.namespace ],

		[ `${ from.constantPrefix }_PRO`, `${ to.constantPrefix }_PRO` ],
		[ from.constantPrefix, to.constantPrefix ],

		[ `${ from.slug }-pro`, `${ to.slug }-pro` ],
		[ from.slug, to.slug ],

		[ `${ from.optionPrefix }_pro`, `${ to.optionPrefix }_pro` ],
		[ from.optionPrefix, to.optionPrefix ],

		[ from.hookPrefix, to.hookPrefix ],

		[ `${ from.title } Pro`, `${ to.title } Pro` ],
		[ from.title, to.title ],
	];

	return pairs
		.filter( ( [ a, b ] ) => a && a !== b )
		.map( ( [ a, b ] ) => [ new RegExp( a.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ), 'g' ), b ] );
}

function walk( dir, files = [] ) {
	for ( const entry of fs.readdirSync( dir, { withFileTypes: true } ) ) {
		if ( entry.name.startsWith( '.' ) && entry.name !== '.distignore' ) continue;
		if ( SKIP_DIRS.has( entry.name ) ) continue;

		const full = path.join( dir, entry.name );

		if ( entry.isDirectory() ) {
			walk( full, files );
		} else if ( TEXT_EXTENSIONS.has( path.extname( entry.name ) ) || entry.name === '.distignore' ) {
			files.push( full );
		}
	}

	return files;
}

export async function run( argv ) {
	const { flags } = parseArgs( argv, { booleans: [ 'dry-run', 'yes', 'no-pro' ] } );
	const current = starter();

	const from = {
		slug: current.slug,
		namespace: current.namespace,
		constantPrefix: current.constantPrefix,
		hookPrefix: current.hookPrefix,
		optionPrefix: current.constantPrefix.toLowerCase(),
		title: current.name,
	};

	let answers = {
		slug: flags.slug,
		name: flags.name,
		namespace: flags.namespace,
		author: flags.author,
	};

	if ( ! flags.yes && ( ! answers.slug || ! answers.namespace ) ) {
		const rl = readline.createInterface( { input: process.stdin, output: process.stdout } );

		log.blank();
		log.info( c.bold( 'Turning the starter into your plugin' ) );
		log.dim( '   Press Enter to keep the value in brackets.' );
		log.blank();

		answers.slug =
			answers.slug || ( await rl.question( `  Plugin slug [${ from.slug }]: ` ) ) || from.slug;

		const suggestedName = slugToTitle( answers.slug );
		answers.name =
			answers.name || ( await rl.question( `  Plugin name [${ suggestedName }]: ` ) ) || suggestedName;

		const vendor = from.namespace.split( '\\' )[ 0 ];
		const suggestedNs = `${ vendor }\\${ slugToNamespace( answers.slug ) }`;
		answers.namespace =
			answers.namespace ||
			( await rl.question( `  PHP namespace [${ suggestedNs }]: ` ) ) ||
			suggestedNs;

		answers.author =
			answers.author ||
			( await rl.question( `  Author [${ current.author }]: ` ) ) ||
			current.author;

		rl.close();
	}

	answers.slug = answers.slug || from.slug;
	answers.name = answers.name || slugToTitle( answers.slug );
	answers.namespace =
		answers.namespace || `${ from.namespace.split( '\\' )[ 0 ] }\\${ slugToNamespace( answers.slug ) }`;
	answers.author = answers.author || current.author;

	validate( answers );

	const to = {
		slug: answers.slug,
		namespace: answers.namespace,
		constantPrefix: answers.slug.replace( /-/g, '_' ).toUpperCase(),
		hookPrefix: answers.slug.replace( /-/g, '' ),
		optionPrefix: answers.slug.replace( /-/g, '_' ),
		title: answers.name,
	};

	if ( from.slug === to.slug && from.namespace === to.namespace ) {
		log.warn( 'Nothing to rename - the slug and namespace already match.' );
		return 0;
	}

	const rules = replacements( from, to );
	const dryRun = Boolean( flags[ 'dry-run' ] );

	// Content first, paths second: renaming directories mid-walk would invalidate the file list.
	const roots = [ paths.plugins, path.join( paths.root, 'tests' ), paths.templates ];
	const files = roots.filter( fs.existsSync ).flatMap( ( dir ) => walk( dir ) );

	// starter.json carries the old slug in free-text fields too (plugin URI, description), so it
	// goes through the same rewrite before the structured fields are set below.
	files.push( paths.starter );

	// Two CI files name the plugin directly and cannot read starter.json: Dependabot has no
	// variables, and the WordPress.org deploy needs a literal slug. Left alone they would keep
	// pointing at the starter's plugin after a rename.
	for ( const relative of [
		'.github/dependabot.yml',
		'.github/workflows/deploy-wporg.yml',
	] ) {
		const file = path.join( paths.root, relative );

		if ( fs.existsSync( file ) ) files.push( file );
	}
	let changed = 0;

	for ( const file of files ) {
		const before = fs.readFileSync( file, 'utf8' );
		let after = before;

		for ( const [ pattern, value ] of rules ) {
			after = after.replace( pattern, value );
		}

		if ( after === before ) continue;

		if ( ! dryRun ) fs.writeFileSync( file, after );

		changed++;
	}

	const renames = [];

	for ( const [ oldDir, newDir ] of [
		[ `${ from.slug }-pro`, `${ to.slug }-pro` ],
		[ from.slug, to.slug ],
	] ) {
		const source = path.join( paths.plugins, oldDir );
		const dest = path.join( paths.plugins, newDir );

		if ( ! fs.existsSync( source ) || source === dest ) continue;

		const oldEntry = path.join( source, `${ oldDir }.php` );
		const newEntry = path.join( source, `${ newDir }.php` );

		if ( ! dryRun ) {
			if ( fs.existsSync( oldEntry ) ) fs.renameSync( oldEntry, newEntry );
			fs.renameSync( source, dest );
		}

		renames.push( `${ oldDir }/ -> ${ newDir }/` );
	}

	if ( ! dryRun ) {
		const data = readJson( paths.starter );

		data.name = to.title;
		data.slug = to.slug;
		data.namespace = to.namespace;
		data.constantPrefix = to.constantPrefix;
		data.hookPrefix = to.hookPrefix;
		data.textDomain = to.slug;
		data.author = answers.author;
		data.editions.free.dir = to.slug;
		data.editions.pro.dir = `${ to.slug }-pro`;

		if ( flags[ 'no-pro' ] ) data.editions.pro.enabled = false;

		writeJson( paths.starter, data );
		resetConfigCache();
	}

	log.blank();
	log.step( `${ dryRun ? 'Would rewrite' : 'Rewrote' } ${ changed } file(s)` );

	for ( const item of renames ) {
		log.info( `  ${ c.cyan( 'renamed' ) }  ${ item }` );
	}

	log.blank();
	log.info( `  slug        ${ to.slug }` );
	log.info( `  namespace   ${ to.namespace }` );
	log.info( `  constants   ${ to.constantPrefix }_*` );
	log.info( `  hooks       ${ to.hookPrefix }_*` );
	log.info( `  text domain ${ to.slug }` );
	log.blank();

	if ( ! dryRun ) {
		log.dim( '   Next: ./bin/wpx reset --all   (rebuilds the sites with the new plugin paths)' );
		log.dim( '   Then: ./bin/wpx test          (everything should still be green)' );
		log.blank();
	}

	return 0;
}
