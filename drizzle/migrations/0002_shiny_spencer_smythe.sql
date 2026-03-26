ALTER TABLE `draws` ADD `status` text DEFAULT 'kept' NOT NULL;--> statement-breakpoint
ALTER TABLE `draws` ADD `decided_at` text;--> statement-breakpoint
ALTER TABLE `draws` ADD `buyback_tx_hash` text;--> statement-breakpoint
ALTER TABLE `draws` ADD `buyback_amount` real;