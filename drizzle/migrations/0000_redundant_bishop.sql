CREATE TABLE `cards` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`rarity` text NOT NULL,
	`element` text NOT NULL,
	`attack` integer NOT NULL,
	`defense` integer NOT NULL,
	`image_uri` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`set_name` text DEFAULT 'Genesis' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `draws` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`oripa_id` integer NOT NULL,
	`slot_id` integer NOT NULL,
	`card_id` integer NOT NULL,
	`rarity` text NOT NULL,
	`user_address` text NOT NULL,
	`tx_hash` text,
	`payment_tx_hash` text,
	`is_last_one` integer DEFAULT false NOT NULL,
	`minted_token_id` integer,
	`created_at` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`oripa_id`) REFERENCES `oripas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`slot_id`) REFERENCES `oripa_slots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `oripa_slots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`oripa_id` integer NOT NULL,
	`slot_index` integer NOT NULL,
	`card_id` integer NOT NULL,
	`rarity` text NOT NULL,
	`pulled_by` text,
	`pulled_at` text,
	FOREIGN KEY (`oripa_id`) REFERENCES `oripas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oripa_slot_idx` ON `oripa_slots` (`oripa_id`,`slot_index`);--> statement-breakpoint
CREATE TABLE `oripas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`total_slots` integer NOT NULL,
	`price_per_draw` real NOT NULL,
	`last_one_prize` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT '' NOT NULL
);
