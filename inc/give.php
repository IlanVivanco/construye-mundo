<?php
/**
 * Add Custom Donation Form Fields
 *
 * @param $form_id
 */
function iv_custom_form_fields( $form_id ) {
	$forms = array( 4327 );
	if ( in_array( $form_id, $forms, true ) ) { ?>
		<p id="give-test-wrap" class="form-row form-row-wide">
			<label class="give-label" for="give-test">
				Dato test
				<span class="give-required-indicator">*</span>
				<span class="give-tooltip hint--top hint--medium hint--bounce" aria-label="" rel="tooltip"><i class="give-icon give-icon-question"></i></span>
			</label>
			<input class="give-input required" type="text" name="give_test" placeholder="Test" id="give-test" required aria-required="true">
		</p>
		<?php
	}
}

// add_action( 'give_purchase_form_register_login_fields', 'iv_custom_form_fields', 10, 1 );

/**
 * Validate the Custom Field
 *
 * Check for errors without custom fields
 *
 * @param $required_fields
 * @param $form_id
 *
 * @return mixed
 */
function iv_validate_custom_fields( $required_fields, $form_id ) {
	$forms = array( 4327 );
	if ( in_array( $form_id, $forms, true ) ) {
		$required_fields['give_test'] = array(
			'error_id'      => 'invalid_give_test',
			'error_message' => __( 'Please tell us how you heard about Girl Develop It.', 'give' ),
		);
	}

	return $required_fields;
}

// add_filter( 'give_donation_form_required_fields', 'iv_validate_custom_fields', 10, 2 );

/**
 * Add Field to Payment Meta
 *
 * Store the custom field data  meta.
 *
 * @param $payment_id
 *
 * @return mixed
 */
function iv_give_donations_save_custom_fields( $payment_id ) {
	if ( isset( $_POST['give_test'] ) ) {
		$message = wp_strip_all_tags( $_POST['give_test'], true );
		give_update_payment_meta( $payment_id, 'give_test', $message );
	}
}

// add_action( 'give_insert_payment', 'iv_give_donations_save_custom_fields' );

/**
 * Show Data in Payment Details
 *
 * Show the custom field(s) on the payment details page in wp-admin within its own metabox.
 *
 * @param int $payment_id
 */
function iv_donation_details( $payment_id ) {
	$give_test = give_get_meta( $payment_id, 'give_test', true );

	// Bounce out if no data for this transaction.
	if ( $give_test ) :
		?>
		<div class="referral-data postbox">
			<h3 class="hndle"></h3>
			<div class="inside">
				<?php echo $give_test; ?>
			</div>
		</div>
		<?php
	endif;
}

// add_action( 'give_view_donation_details_billing_after', 'iv_donation_details' );
