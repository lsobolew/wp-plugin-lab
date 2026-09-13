import { request } from '@playwright/test';
import { RequestUtils } from '@wordpress/e2e-test-utils-playwright';

/**
 * Loguje sie raz na caly przebieg i zapisuje ciasteczka oraz nonce REST do pliku stanu.
 * Bez tego kazdy spec przechodzilby przez formularz logowania, co przy macierzy wersji
 * zamienia sie w kilkadziesiat niepotrzebnych logowan.
 */
export default async function globalSetup( config ) {
	const { storageState, baseURL } = config.projects[ 0 ].use;
	const storageStatePath = typeof storageState === 'string' ? storageState : undefined;

	const context = await request.newContext( { baseURL } );

	const requestUtils = new RequestUtils( context, {
		storageStatePath,
		user: {
			username: process.env.WP_USERNAME || 'admin',
			password: process.env.WP_PASSWORD || 'password',
		},
	} );

	await requestUtils.setupRest();
	await context.dispose();
}
