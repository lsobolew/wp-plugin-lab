import { parseArgs } from '../lib/args.mjs';
import { resolveMatrix } from '../lib/matrix.mjs';
import { availableEditions, allPackages } from '../lib/runner.mjs';
import { log, c } from '../lib/log.mjs';

/**
 * Prints the resolved matrix. `--json` feeds GitHub Actions, which expands it with fromJSON()
 * into one job per WordPress version - so CI coverage follows wp-matrix.json automatically.
 */
export async function run( argv ) {
	const { flags } = parseArgs( argv, { booleans: [ 'json' ] } );
	const matrix = await resolveMatrix();

	if ( flags.json ) {
		process.stdout.write(
			JSON.stringify( {
				include: matrix.targets.map( ( t ) => ( {
					id: t.id,
					wp: t.wpVersion,
					php: t.php,
					port: t.port,
					multisite: t.multisite,
				} ) ),
			} ) + '\n'
		);

		return 0;
	}

	log.blank();
	log.info( c.bold( 'Resolved matrix' ) );
	log.blank();

	for ( const t of matrix.targets ) {
		log.info(
			`  ${ t.id.padEnd( 9 ) } ${ String( t.wpSpec ).padEnd( 10 ) } -> WP ${ String(
				t.wpVersion
			).padEnd( 9 ) } PHP ${ t.php }  ${ t.url }${ t.multisite ? '  (multisite)' : '' }`
		);
	}

	log.blank();
	log.info( `  editions: ${ availableEditions().join( ', ' ) }` );
	log.info( `  packages: ${ allPackages().map( ( p ) => p.dir ).join( ', ' ) }` );
	log.blank();

	return 0;
}
