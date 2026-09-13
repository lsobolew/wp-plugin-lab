/**
 * Testy e2e typu tresci i wlasnego endpointu REST.
 */
import { test, expect } from '@wordpress/e2e-test-utils-playwright';

const CREATED = [];

test.describe( 'Elementy wtyczki', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		for ( const title of [ 'E2E Alfa', 'E2E Beta', 'E2E Gamma' ] ) {
			const item = await requestUtils.rest( {
				method: 'POST',
				path: '/wp/v2/myplugin_item',
				data: { title, status: 'publish' },
			} );
			CREATED.push( item.id );
		}
	} );

	test.afterAll( async ( { requestUtils } ) => {
		for ( const id of CREATED ) {
			await requestUtils.rest( {
				method: 'DELETE',
				path: `/wp/v2/myplugin_item/${ id }`,
				params: { force: true },
			} );
		}
		CREATED.length = 0;
	} );

	test( 'archiwum typu tresci pokazuje elementy', async ( { page } ) => {
		await page.goto( '/items/' );

		await expect( page.getByText( 'E2E Alfa' ).first() ).toBeVisible();
		await expect( page.getByText( 'E2E Gamma' ).first() ).toBeVisible();
	} );

	test( 'wlasny endpoint REST zwraca elementy', async ( { requestUtils } ) => {
		const items = await requestUtils.rest( { path: '/my-plugin/v1/items' } );

		expect( Array.isArray( items ) ).toBe( true );
		expect( items.length ).toBeGreaterThan( 0 );
		expect( items[ 0 ] ).toHaveProperty( 'title' );
		expect( items[ 0 ] ).toHaveProperty( 'priority' );
	} );

	test( 'endpoint respektuje parametr per_page', async ( { requestUtils } ) => {
		const items = await requestUtils.rest( {
			path: '/my-plugin/v1/items',
			params: { per_page: 2 },
		} );

		expect( items ).toHaveLength( 2 );
	} );

	test( 'blok listy elementow renderuje sie na froncie', async ( { requestUtils, page } ) => {
		const post = await requestUtils.rest( {
			method: 'POST',
			path: '/wp/v2/posts',
			data: {
				title: 'E2E blok',
				status: 'publish',
				content: '<!-- wp:my-plugin/item-list {"limit":2} /-->',
			},
		} );

		await page.goto( `/?p=${ post.id }` );
		await expect( page.locator( 'ul.my-plugin-item-list li' ) ).toHaveCount( 2 );

		await requestUtils.rest( {
			method: 'DELETE',
			path: `/wp/v2/posts/${ post.id }`,
			params: { force: true },
		} );
	} );
} );
