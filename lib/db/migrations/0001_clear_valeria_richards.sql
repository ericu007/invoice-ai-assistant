CREATE TABLE `Invoice` (
	`id` text PRIMARY KEY NOT NULL,
	`documentId` text NOT NULL,
	`documentCreatedAt` integer NOT NULL,
	`vendorName` text NOT NULL,
	`customerName` text NOT NULL,
	`invoiceNumber` text NOT NULL,
	`invoiceDate` text NOT NULL,
	`dueDate` text,
	`amount` text NOT NULL,
	`lineItems` blob,
	`tokenUsage` blob,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`documentId`,`documentCreatedAt`) REFERENCES `Document`(`id`,`createdAt`) ON UPDATE no action ON DELETE no action
);
