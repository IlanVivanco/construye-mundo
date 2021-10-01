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
add_action( 'wp_enqueue_scripts', 'iv_enqueue_styles', 15 );

function iv_enqueue_styles() {
	wp_enqueue_style( 'construye-mundo-theme-css', get_stylesheet_directory_uri() . '/style.css', array( 'astra-theme-css' ), CM_THEME_VERSION, 'all' );
}

function child_enqueue_styles() {
	wp_enqueue_style( 'construye-mundo-theme-css', get_stylesheet_directory_uri() . '/style.css', array( 'astra-theme-css' ), CHILD_THEME_VERSION, 'all' );
}

add_action( 'wp_enqueue_scripts', 'child_enqueue_styles', 15 );
