/**
 * Testy e2e edycji Pro. Ten katalog wchodzi do przebiegu tylko przy --edition=pro.
 */
import { test, expect } from '@wordpress/e2e-test-utils-playwright';

test.describe( 'Edycja Pro', () => {
	test( 'sekcja licencji jest na stronie ustawien wtyczki darmowej', async ( {
		admin,
		page,
	} ) => {
		await admin.visitAdminPage( 'options-general.php', 'page=my-plugin' );

		await expect(
			page.getByRole( 'heading', { name: 'Licencja Pro' } )
		).toBeVisible();
		await expect( page.locator( '#my-plugin-pro-license-key' ) ).toBeVisible();
		await expect( page.locator( '#my-plugin-pro-license-status' ) ).toContainText(
			'brak klucza'
		);
	} );

	test( 'dodatek rozszerza odpowiedz REST wtyczki darmowej', async ( { requestUtils } ) => {
		const item = await requestUtils.rest( {
			method: 'POST',
			path: '/wp/v2/myplugin_item',
			data: { title: 'E2E Pro', status: 'publish' },
		} );

		const items = await requestUtils.rest( { path: '/my-plugin/v1/items' } );

		expect( items[ 0 ] ).toHaveProperty( 'edition', 'pro' );
		expect( items[ 0 ] ).toHaveProperty( 'featured' );

		await requestUtils.rest( {
			method: 'DELETE',
			path: `/wp/v2/myplugin_item/${ item.id }`,
			params: { force: true },
		} );
	} );

	test( 'pole licencji zapisuje sie w tym samym formularzu co reszta ustawien', async ( {
		admin,
		page,
	} ) => {
		await admin.visitAdminPage( 'options-general.php', 'page=my-plugin' );

		// Jeden formularz Settings API - zapis licencji i zapis pozostalych ustawien to ten sam
		// przycisk. Zagniezdzony <form> rozbilby ten ekran, wiec pilnujemy tego testem.
		await expect( page.locator( '#my-plugin-settings form' ) ).toHaveCount( 1 );

		await page.fill( 'input[name="my_plugin_pro_license[key]"]', 'TEST-KEY-0000' );
		await page.fill( 'input[name="my_plugin_settings[api_label]"]', 'razem-z-licencja' );
		await page.getByRole( 'button', { name: /Zapisz|Save/ } ).click();

		await expect( page.locator( '#setting-error-settings_updated' ) ).toBeVisible();

		await admin.visitAdminPage( 'options-general.php', 'page=my-plugin' );

		// Serwer licencji nie istnieje, wiec status ma byc "nieznany" - klucz zapisany,
		// ekran dziala, a zwykle ustawienia zapisaly sie razem z nim.
		await expect( page.locator( '#my-plugin-pro-license-key' ) ).toHaveValue( 'TEST-KEY-0000' );
		await expect( page.locator( '#my-plugin-pro-license-status' ) ).toContainText( 'nieznany' );
		await expect(
			page.locator( 'input[name="my_plugin_settings[api_label]"]' )
		).toHaveValue( 'razem-z-licencja' );

		// Sprzatanie: puste pole zwalnia licencje.
		await page.fill( 'input[name="my_plugin_pro_license[key]"]', '' );
		await page.getByRole( 'button', { name: /Zapisz|Save/ } ).click();
	} );
} );
