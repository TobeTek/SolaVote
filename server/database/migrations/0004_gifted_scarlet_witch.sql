CREATE TABLE `results` (
	`id` text PRIMARY KEY NOT NULL,
	`election_id` text NOT NULL,
	`total_votes` integer NOT NULL,
	`results` text NOT NULL,
	`winners` text NOT NULL,
	`closed_at` integer NOT NULL,
	`decrypted_votes` text,
	FOREIGN KEY (`election_id`) REFERENCES `elections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `votes` (
	`id` text PRIMARY KEY NOT NULL,
	`election_id` text NOT NULL,
	`voter_address` text NOT NULL,
	`encrypted_vote` text NOT NULL,
	`merkle_proof` text,
	`voted_at` integer NOT NULL,
	FOREIGN KEY (`election_id`) REFERENCES `elections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_elections` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`creator_address` text NOT NULL,
	`start_time` text,
	`end_time` text,
	`is_private` integer DEFAULT false,
	`is_active` integer DEFAULT false,
	`public_key` text NOT NULL,
	`private_key` text NOT NULL,
	`id_card_template` text NOT NULL,
	`whitelist` text DEFAULT '[]',
	`voters` text DEFAULT '[]',
	`candidates` text NOT NULL,
	`merkle_tree` text DEFAULT '{"root":"","leaves":[],"layers":[]}',
	`created_at` integer DEFAULT '"2025-09-27T09:29:47.534Z"'
);
--> statement-breakpoint
INSERT INTO `__new_elections`("id", "title", "creator_address", "start_time", "end_time", "is_private", "is_active", "public_key", "private_key", "id_card_template", "whitelist", "voters", "candidates", "merkle_tree", "created_at") SELECT "id", "title", "creator_address", "start_time", "end_time", "is_private", "is_active", "public_key", "private_key", "id_card_template", "whitelist", "voters", "candidates", "merkle_tree", "created_at" FROM `elections`;--> statement-breakpoint
DROP TABLE `elections`;--> statement-breakpoint
ALTER TABLE `__new_elections` RENAME TO `elections`;--> statement-breakpoint
PRAGMA foreign_keys=ON;