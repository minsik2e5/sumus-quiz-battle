CREATE TABLE `ledger` (
	`workspace` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`state_json` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ledger_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace` text NOT NULL,
	`revision` integer NOT NULL,
	`state_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ledger_versions_workspace_revision` ON `ledger_versions` (`workspace`,`revision`);