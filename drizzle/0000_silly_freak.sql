CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`service_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`date` text NOT NULL,
	`time` text NOT NULL,
	`customer_name` text NOT NULL,
	`customer_phone` text NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`cancel_token_hash` text NOT NULL,
	`sms_status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`duration_minutes` integer NOT NULL,
	`price_cents` integer,
	`active` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `slot_locks` (
	`staff_id` text NOT NULL,
	`date` text NOT NULL,
	`time` text NOT NULL,
	`booking_id` text NOT NULL,
	PRIMARY KEY(`staff_id`, `date`, `time`),
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `staff` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `staff_services` (
	`staff_id` text NOT NULL,
	`service_id` text NOT NULL,
	PRIMARY KEY(`staff_id`, `service_id`),
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action
);
