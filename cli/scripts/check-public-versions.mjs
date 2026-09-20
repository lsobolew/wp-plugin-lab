import fs from 'node:fs';
import path from 'node:path';
import { paths, readJson } from '../lib/paths.mjs';

const tag = ( process.argv[ 2 ] || '' ).replace( /^v/, '' );
if ( ! tag ) throw new Error( 'Pass a release tag such as v1.2.0.' );
const starter = readJson( paths.starter );
const publicEditions = Object.entries( starter.editions || {} ).filter( ( [ , edition ] ) =>
	edition.enabled && ( edition.distribution || 'public' ) === 'public' );
if ( ! publicEditions.length ) throw new Error( 'No public edition is configured.' );
for ( const [ name, edition ] of publicEditions ) {
	const plugin = path.join( paths.plugins, edition.dir, `${ edition.dir }.php` );
	const match = fs.readFileSync( plugin, 'utf8' ).slice( 0, 4096 ).match( /^\s*\*\s*Version:\s*(.+)$/m );
	const version = match?.[ 1 ].trim();
	if ( version !== tag ) throw new Error( `Tag ${ tag } does not match ${ name } header ${ version || '(missing)' }.` );
}
console.log( `Tag ${ tag } matches: ${ publicEditions.map( ( [ name ] ) => name ).join( ', ' ) }` );
