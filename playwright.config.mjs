import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname( fileURLToPath( import.meta.url ) );

// Konfiguracja jest sterowana zmiennymi z `wpx test e2e` - jeden przebieg = jedna wersja WP
// w jednej edycji, dzieki czemu raporty i wyniki JUnit nie mieszaja sie miedzy soba.
const targetId = process.env.WPLAB_TARGET || 'latest';
const edition = process.env.WPLAB_EDITION || 'free';
const baseURL = process.env.WP_BASE_URL || 'http://localhost:8091';
const artifacts = path.join( root, '.wplab', 'artifacts', `${ targetId }-${ edition }` );

// Specy e2e zyja w korzeniu repo, a nie w katalogu wtyczki, z dwoch powodow: testuja cale
// dzialajace srodowisko (nie paczke), a przy okazji omijaja druga kopie Playwrighta, ktora
// @wordpress/scripts instaluje w node_modules wtyczki - dwie instancje nie potrafia sie dogadac.
//
// W edycji free specy dodatku nie wchodza do zestawu, inaczej kazdy z nich musialby sam
// sprawdzac, czy Pro jest aktywne.
const testMatch = edition === 'pro' ? [ '**/*.spec.js' ] : [ 'free/**/*.spec.js' ];

export default defineConfig( {
	testDir: path.join( root, 'tests', 'e2e' ),
	testMatch,
	outputDir: path.join( artifacts, 'test-results' ),
	globalSetup: path.join( root, 'tests', 'e2e-global-setup.mjs' ),
	timeout: 60_000,
	expect: { timeout: 10_000 },
	forbidOnly: Boolean( process.env.CI ),
	retries: process.env.CI ? 1 : 0,
	workers: 1,
	reporter: [
		[ 'list' ],
		[ 'junit', { outputFile: path.join( root, '.wplab', 'results', `${ targetId }-${ edition }-e2e.xml` ) } ],
		[ 'html', { outputFolder: path.join( root, 'playwright-report', `${ targetId }-${ edition }` ), open: 'never' } ],
	],
	use: {
		...devices[ 'Desktop Chrome' ],
		baseURL,
		// Stan logowania zapisany przez globalSetup - testy nie przechodza przez formularz logowania.
		storageState: path.join( artifacts, 'storage-states', 'admin.json' ),
		video: 'off',
		screenshot: 'only-on-failure',
		trace: 'retain-on-failure',
	},
} );
