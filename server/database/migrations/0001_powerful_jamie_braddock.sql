CREATE TABLE `elections` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`creator_address` text NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`is_private` integer DEFAULT false,
	`is_active` integer DEFAULT false,
	`public_key` text NOT NULL,
	`private_key` text NOT NULL,
	`id_card_template` text NOT NULL,
	`whitelist` text DEFAULT '[]',
	`voters` text DEFAULT '[]',
	`candidates` text NOT NULL,
	`merkle_tree` text,
	`created_at` integer DEFAULT '"2025-09-26T14:12:46.435Z"'
);
