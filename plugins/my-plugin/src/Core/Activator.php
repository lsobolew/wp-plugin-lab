<?php
/**
 * Plugin activation.
 *
 * @package MyVendor\MyPlugin
 */

declare( strict_types=1 );

namespace MyVendor\MyPlugin\Core;

defined( 'ABSPATH' ) || exit;

/**
 * Sets up the initial state. Note that modules are not registered yet at activation time, so
 * instead of rebuilding the rewrite rules right away we leave a flag - `Upgrader` flushes them on
 * the next `wp_loaded`, once the custom post types have been declared.
 */
final class Activator {

	/**
	 * Option holding the data schema version.
	 */
	const VERSION_OPTION = 'my_plugin_version';

	/**
	 * Flag requesting a rewrite rules flush.
	 */
	const FLUSH_FLAG = 'my_plugin_flush_rewrite';

	/**
	 * Called by register_activation_hook.
	 *
	 * @param bool $network_wide Whether the plugin is being activated network-wide.
	 */
	public static function activate( $network_wide = false ): void {
		if ( $network_wide && is_multisite() ) {
			foreach ( self::site_ids() as $site_id ) {
				switch_to_blog( $site_id );
				self::activate_single_site();
				restore_current_blog();
			}

			return;
		}

		self::activate_single_site();
	}

	/**
	 * Initializes a single site.
	 */
	private static function activate_single_site(): void {
		if ( false === get_option( Settings::OPTION, false ) ) {
			add_option( Settings::OPTION, Settings::defaults() );
		}

		update_option( self::VERSION_OPTION, MY_PLUGIN_VERSION );
		update_option( self::FLUSH_FLAG, '1' );
	}

	/**
	 * Site ids in the network.
	 *
	 * @return int[]
	 */
	private static function site_ids(): array {
		if ( ! is_multisite() ) {
			return array();
		}

		return array_map(
			'intval',
			get_sites(
				array(
					'fields' => 'ids',
					'number' => 0,
				)
			)
		);
	}
}
