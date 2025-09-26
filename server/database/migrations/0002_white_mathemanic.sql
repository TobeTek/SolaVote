PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_elections` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`creator_address` text NOT NULL,
	`start_time` integer,
	`end_time` integer,
	`is_private` integer DEFAULT false,
	`is_active` integer DEFAULT false,
	`public_key` text NOT NULL,
	`private_key` text NOT NULL,
	`id_card_template` text NOT NULL,
	`whitelist` text DEFAULT '[]',
	`voters` text DEFAULT '[]',
	`candidates` text NOT NULL,
	`merkle_tree` text,
	`created_at` integer DEFAULT '"2025-09-26T18:46:59.129Z"'
);
--> statement-breakpoint
INSERT INTO `__new_elections`("id", "title", "creator_address", "start_time", "end_time", "is_private", "is_active", "public_key", "private_key", "id_card_template", "whitelist", "voters", "candidates", "merkle_tree", "created_at") SELECT "id", "title", "creator_address", "start_time", "end_time", "is_private", "is_active", "public_key", "private_key", "id_card_template", "whitelist", "voters", "candidates", "merkle_tree", "created_at" FROM `elections`;--> statement-breakpoint
DROP TABLE `elections`;--> statement-breakpoint
ALTER TABLE `__new_elections` RENAME TO `elections`;--> statement-breakpoint
PRAGMA foreign_keys=ON;