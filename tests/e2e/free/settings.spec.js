/**
 * Testy e2e ekranu ustawien.
 */
import { test, expect } from '@wordpress/e2e-test-utils-playwright';

test.describe( 'Ekran ustawien', () => {
	test( 'jest dostepny z menu Ustawienia', async ( { admin, page } ) => {
		await admin.visitAdminPage( 'options-general.php', 'page=my-plugin' );

		await expect(
			page.getByRole( 'heading', { name: 'My Plugin', level: 1 } )
		).toBeVisible();
	} );

	test( 'zapisuje zmienione wartosci', async ( { admin, page } ) => {
		const label = `etykieta-${ Date.now() }`;

		await admin.visitAdminPage( 'options-general.php', 'page=my-plugin' );

		await page.fill( 'input[name="my_plugin_settings[api_label]"]', label );
		await page.fill( 'input[name="my_plugin_settings[items_per_page]"]', '7' );
		await page.getByRole( 'button', { name: /Zapisz|Save/ } ).click();

		// WordPress po zapisie wraca na strone ustawien z komunikatem potwierdzajacym.
		await expect( page.locator( '#setting-error-settings_updated' ) ).toBeVisible();

		await admin.visitAdminPage( 'options-general.php', 'page=my-plugin' );

		await expect(
			page.locator( 'input[name="my_plugin_settings[api_label]"]' )
		).toHaveValue( label );
		await expect(
			page.locator( 'input[name="my_plugin_settings[items_per_page]"]' )
		).toHaveValue( '7' );
	} );

	test( 'odrzuca wartosci spoza zakresu', async ( { admin, page } ) => {
		await admin.visitAdminPage( 'options-general.php', 'page=my-plugin' );

		// Pole liczbowe ma min=1, wiec przegladarka nie puscilaby 0 - wysylamy je z pominieciem
		// walidacji HTML, zeby sprawdzic sanityzacje po stronie serwera.
		await page.evaluate( () => {
			const input = document.querySelector(
				'input[name="my_plugin_settings[items_per_page]"]'
			);
			input.removeAttribute( 'min' );
			input.value = '0';
		} );
		await page.getByRole( 'button', { name: /Zapisz|Save/ } ).click();

		await admin.visitAdminPage( 'options-general.php', 'page=my-plugin' );

		await expect(
			page.locator( 'input[name="my_plugin_settings[items_per_page]"]' )
		).toHaveValue( '1' );
	} );
} );
