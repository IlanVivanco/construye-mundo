<?php
/**
 * Plugin Name: Silence debug log noise
 * Description: Keeps known, harmless plugin notices out of debug.log so real errors stand out.
 *
 * Dropped, and nothing else:
 * - Photo Gallery (10Web) calls __() before `init`: a `_load_textdomain_just_in_time` notice on every request,
 *   99.9 % of debug.log by November 2026.
 * - Photo Gallery's bundled 10Web library creates dynamic properties: PHP 8.2 deprecations from
 *   `photo-gallery/wd/`, ~700 a day.
 * - Elementor 4.4+ and Novamira Pro both register the `elementor` abilities category: a "category already registered"
 *   notice on every request since 2026-11-17. The first registration wins; nothing breaks.
 *
 * Delete each rule when its plugin is removed or fixed; delete the file when no rule is left.
 */

defined( 'ABSPATH' ) || exit;

add_filter(
	'doing_it_wrong_trigger_error',
	static function ( $trigger, $function_name, $message ) {
		if ( '_load_textdomain_just_in_time' === $function_name && str_contains( $message, '<code>photo-gallery</code>' ) ) {
			return false;
		}
		if ( 'WP_Ability_Categories_Registry::register' === $function_name && str_contains( $message, 'elementor' ) ) {
			return false;
		}
		return $trigger;
	},
	10,
	3
);

// Runs before plugins load, so it sees Photo Gallery's deprecations. Other errors go to the previous handler, or to
// PHP's own when there is none.
$cm_previous_error_handler = set_error_handler(
	static function ( $errno, $errstr, $errfile = '', $errline = 0 ) use ( &$cm_previous_error_handler ) {
		if ( E_DEPRECATED === $errno
			&& str_contains( wp_normalize_path( $errfile ), '/plugins/photo-gallery/wd/' )
			&& str_starts_with( $errstr, 'Creation of dynamic property' ) ) {
			return true;
		}
		return $cm_previous_error_handler ? call_user_func( $cm_previous_error_handler, $errno, $errstr, $errfile, $errline ) : false;
	}
);
