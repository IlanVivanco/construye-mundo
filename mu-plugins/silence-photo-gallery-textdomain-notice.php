<?php
/**
 * Plugin Name: Silence Photo Gallery textdomain notice
 * Description: Keeps Photo Gallery's "translation loading triggered too early" notice out of debug.log.
 *
 * Photo Gallery (10Web) calls __() in its constructor, before `init`, so WordPress 6.7+ logs a
 * `_load_textdomain_just_in_time` notice on every request: 99.9 % of debug.log by November 2026.
 * Only that notice is dropped; every other error still reaches the log.
 *
 * Delete this file when Photo Gallery is removed or fixes the early call.
 */

defined( 'ABSPATH' ) || exit;

add_filter(
	'doing_it_wrong_trigger_error',
	static function ( $trigger, $function_name, $message ) {
		if ( '_load_textdomain_just_in_time' === $function_name && str_contains( $message, '<code>photo-gallery</code>' ) ) {
			return false;
		}
		return $trigger;
	},
	10,
	3
);
