CREATE TABLE `users` (
	`clerk_user_id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`metadata` text
);
--> statement-breakpoint
CREATE INDEX `users_created_at_idx` ON `users` (`created_at`);--> statement-breakpoint
CREATE TABLE `wallets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`credit_balance` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`clerk_user_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "credit_balance_non_negative" CHECK("wallets"."credit_balance" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallets_user_id_unique` ON `wallets` (`user_id`);--> statement-breakpoint
CREATE TABLE `scan_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`url` text NOT NULL,
	`state` text DEFAULT 'QUEUED' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`clerk_user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scan_jobs_user_id_idx` ON `scan_jobs` (`user_id`);--> statement-breakpoint
CREATE INDEX `scan_jobs_state_idx` ON `scan_jobs` (`state`);--> statement-breakpoint
CREATE INDEX `scan_jobs_created_at_idx` ON `scan_jobs` (`created_at`);--> statement-breakpoint
CREATE INDEX `scan_jobs_user_id_created_at_idx` ON `scan_jobs` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `scan_jobs_url_idx` ON `scan_jobs` (`url`);--> statement-breakpoint
CREATE INDEX `scan_jobs_state_created_at_idx` ON `scan_jobs` (`state`,`created_at`);--> statement-breakpoint
CREATE TABLE `scan_results` (
	`job_id` text PRIMARY KEY NOT NULL,
	`risk_score` integer NOT NULL,
	`categories` text NOT NULL,
	`content_hash` text NOT NULL,
	`http_status` integer,
	`http_headers` text,
	`content_type` text,
	`model_used` text NOT NULL,
	`analysis_metadata` text,
	`reasoning` text NOT NULL,
	`indicators` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `scan_jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "risk_score_range" CHECK("scan_results"."risk_score" >= 0 AND "scan_results"."risk_score" <= 100)
);
--> statement-breakpoint
CREATE INDEX `scan_results_content_hash_idx` ON `scan_results` (`content_hash`);--> statement-breakpoint
CREATE INDEX `scan_results_created_at_idx` ON `scan_results` (`created_at`);--> statement-breakpoint
CREATE INDEX `scan_results_risk_score_idx` ON `scan_results` (`risk_score`);--> statement-breakpoint
CREATE INDEX `scan_results_risk_score_created_at_idx` ON `scan_results` (`risk_score`,`created_at`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_job_id` text NOT NULL,
	`url_accessed` text NOT NULL,
	`timestamp` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`content_hash` text NOT NULL,
	`http_status` integer,
	`http_headers` text,
	`content_type` text,
	`risk_assessment_summary` text,
	FOREIGN KEY (`scan_job_id`) REFERENCES `scan_jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audit_logs_scan_job_id_idx` ON `audit_logs` (`scan_job_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_timestamp_idx` ON `audit_logs` (`timestamp`);--> statement-breakpoint
CREATE INDEX `audit_logs_url_accessed_idx` ON `audit_logs` (`url_accessed`);--> statement-breakpoint
CREATE INDEX `audit_logs_scan_job_id_timestamp_idx` ON `audit_logs` (`scan_job_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `audit_logs_content_hash_idx` ON `audit_logs` (`content_hash`);