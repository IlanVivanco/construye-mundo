<?php
/**
 * Construye Mundo Theme
 *
 * @author Ilán Vivanco <ilanvivanco@gmail.com>
 * @package Construye Mundo
 * @since 1.0.0
 */

/**
 * Define Constants
 */
define( 'CM_THEME_VERSION', '1.0.0' );

/**
 * Enqueue styles
 */
function iv_enqueue_styles() {
	wp_enqueue_style( 'construye-mundo-theme-css', get_stylesheet_directory_uri() . '/style.css', array( 'astra-theme-css' ), CM_THEME_VERSION, 'all' );
}
add_action( 'wp_enqueue_scripts', 'iv_enqueue_styles', 15 );

/**
 * Filter blog page to show only 'noticias'
 *
 * @param WP_Query $query Current $query.
 */
function iv_filter_blog_posts_on_blog_page( $query ) {
	if ( ! is_admin() && $query->is_home() && $query->is_main_query() ) {
		$query->set( 'cat', 3 );
	}
}
add_action( 'pre_get_posts', 'iv_filter_blog_posts_on_blog_page' );

/**
 * Disables AddToAny's core script on non-posts
 *
 * @param Boolean $script_disabled  Current status.
 */
function addtoany_disable_script_except_for_posts( $script_disabled ) {
	if ( ! is_single() && ! is_archive() ) {
		return true;
	}

	return $script_disabled;
}
add_filter( 'addtoany_script_disabled', 'addtoany_disable_script_except_for_posts' );

/**
 * Extend GiveWP plugin
 */
// require get_stylesheet_directory() . '/inc/give.php';
