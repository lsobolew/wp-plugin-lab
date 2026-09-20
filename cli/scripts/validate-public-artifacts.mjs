import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const file = path.resolve( process.argv[ 2 ] || '.wplab/public-artifacts/build-manifest.json' );
if ( ! fs.existsSync( file ) ) throw new Error( `Build manifest not found: ${ file }` );
const manifest = JSON.parse( fs.readFileSync( file, 'utf8' ) );
if ( manifest.schemaVersion !== 1 || manifest.publicOnly !== true || ! Array.isArray( manifest.artifacts ) || ! manifest.artifacts.length ) {
	throw new Error( 'Expected a non-empty public-only build manifest.' );
}
const directory = path.dirname( file );
const declared = new Set();
for ( const artifact of manifest.artifacts ) {
	if ( artifact.distribution !== 'public' || ! /^(free|pro)$/.test( artifact.edition ) || path.basename( artifact.file ) !== artifact.file || ! artifact.file.endsWith( '.zip' ) ) {
		throw new Error( 'Manifest contains an invalid or local artifact.' );
	}
	const zip = path.join( directory, artifact.file );
	if ( ! fs.existsSync( zip ) ) throw new Error( `Declared artifact is missing: ${ artifact.file }` );
	const bytes = fs.readFileSync( zip );
	const digest = crypto.createHash( 'sha256' ).update( bytes ).digest( 'hex' );
	if ( bytes.length !== artifact.size || digest !== artifact.sha256 ) throw new Error( `Artifact does not match manifest: ${ artifact.file }` );
	declared.add( artifact.file );
}
const extra = fs.readdirSync( directory ).filter( ( name ) => name.endsWith( '.zip' ) && ! declared.has( name ) );
if ( extra.length ) throw new Error( `Undeclared ZIP artifacts: ${ extra.join( ', ' ) }` );
console.log( manifest.artifacts.map( ( artifact ) => path.join( directory, artifact.file ) ).join( '\n' ) );
