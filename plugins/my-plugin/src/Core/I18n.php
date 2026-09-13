<?php
/**
 * Translation loading.
 *
 * @package MyVendor\MyPlugin
 */

declare( strict_types=1 );

namespace MyVendor\MyPlugin\Core;

defined( 'ABSPATH' ) || exit;

/**
 * Loads translations from languages/ (plugins hosted on WordPress.org also receive community
 * translations automatically).
 */
final class I18n {

	/**
	 * Registers the text domain.
	 */
	public function load(): void {
		load_plugin_textdomain(
			'my-plugin',
			false,
			dirname( MY_PLUGIN_BASENAME ) . '/languages'
		);
	}
}
