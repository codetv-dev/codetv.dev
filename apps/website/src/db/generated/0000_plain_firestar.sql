CREATE TABLE `ctv_Account` (
	`userId` varchar(255) NOT NULL,
	`type` varchar(255) NOT NULL,
	`provider` varchar(255) NOT NULL,
	`providerAccountId` varchar(255) NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`oauth_token` text,
	`oauth_token_secret` text,
	`expires_at` int,
	`token_type` varchar(255),
	`scope` varchar(255),
	`id_token` text,
	`session_state` varchar(255),
	`refresh_token_expires_in` int,
	CONSTRAINT `ctv_Account_provider_providerAccountId_pk` PRIMARY KEY(`provider`,`providerAccountId`)
);
--> statement-breakpoint
CREATE TABLE `ctv_Comment` (
	`id` varchar(191) NOT NULL,
	`userId` varchar(255) NOT NULL,
	`organizationMembershipId` varchar(255),
	`context` json DEFAULT ('{}'),
	`text` text NOT NULL,
	`createdAt` timestamp(3) DEFAULT CURRENT_TIMESTAMP(3),
	`updatedAt` timestamp(3) DEFAULT CURRENT_TIMESTAMP(3),
	`deletedAt` timestamp(3),
	CONSTRAINT `ctv_Comment_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ctv_CommunicationChannel` (
	`id` varchar(255) NOT NULL,
	`organizationId` varchar(191),
	`name` varchar(255) NOT NULL,
	`description` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp(3) DEFAULT (now()),
	`updatedAt` timestamp(3) DEFAULT (now()),
	`deletedAt` timestamp(3),
	CONSTRAINT `ctv_CommunicationChannel_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ctv_CommunicationPreferenceType` (
	`id` varchar(255) NOT NULL,
	`organizationId` varchar(191),
	`name` varchar(255) NOT NULL,
	`description` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp(3) DEFAULT (now()),
	`updatedAt` timestamp(3),
	`deletedAt` timestamp(3),
	CONSTRAINT `ctv_CommunicationPreferenceType_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ctv_CommunicationPreference` (
	`id` varchar(255) NOT NULL,
	`organizationId` varchar(191),
	`userId` varchar(255) NOT NULL,
	`organizationMembershipId` varchar(255),
	`channelId` varchar(255) NOT NULL,
	`preferenceLevel` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`preferenceTypeId` varchar(255) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp(3) DEFAULT (now()),
	`optInAt` timestamp(3),
	`optOutAt` timestamp(3),
	`updatedAt` timestamp(3) DEFAULT (now()),
	`deletedAt` timestamp(3),
	CONSTRAINT `ctv_CommunicationPreference_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ctv_ContentContribution` (
	`id` varchar(255) NOT NULL,
	`userId` varchar(255) NOT NULL,
	`organizationId` varchar(191),
	`organizationMembershipId` varchar(255),
	`contentId` varchar(255) NOT NULL,
	`contributionTypeId` varchar(255) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp(3) DEFAULT (now()),
	`updatedAt` timestamp(3) DEFAULT (now()),
	`deletedAt` timestamp(3),
	CONSTRAINT `ctv_ContentContribution_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ctv_ContentResource` (
	`id` varchar(255) NOT NULL,
	`organizationId` varchar(191),
	`createdByOrganizationMembershipId` varchar(191),
	`type` varchar(255) NOT NULL,
	`createdById` varchar(255) NOT NULL,
	`fields` json DEFAULT ('{}'),
	`slug` varchar(255) GENERATED ALWAYS AS ((fields->>'$.slug')) STORED,
	`currentVersionId` varchar(255),
	`createdAt` timestamp(3) DEFAULT CURRENT_TIMESTAMP(3),
	`updatedAt` timestamp(3) DEFAULT CURRENT_TIMESTAMP(3),
	`deletedAt` timestamp(3),
	CONSTRAINT `ctv_ContentResource_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ctv_ContentResourceProduct` (
	`productId` varchar(255) NOT NULL,
	`resourceId` varchar(255) NOT NULL,
	`organizationId` varchar(191),
	`position` double NOT NULL DEFAULT 0,
	`metadata` json DEFAULT ('{}'),
	`createdAt` timestamp(3) DEFAULT CURRENT_TIMESTAMP(3),
	`updatedAt` timestamp(3) DEFAULT CURRENT_TIMESTAMP(3),
	`deletedAt` timestamp(3),
	CONSTRAINT `ctv_ContentResourceProduct_productId_resourceId_pk` PRIMARY KEY(`productId`,`resourceId`)
);
--> statement-breakpoint
CREATE TABLE `ctv_ContentResourceResource` (
	`resourceOfId` varchar(255) NOT NULL,
	`resourceId` varchar(255) NOT NULL,
	`position` double NOT NULL DEFAULT 0,
	`metadata` json DEFAULT ('{}'),
	`organizationId` varchar(191),
	`createdAt` timestamp(3) DEFAULT CURRENT_TIMESTAMP(3),
	`updatedAt` timestamp(3) DEFAULT CURRENT_TIMESTAMP(3),
	`deletedAt` timestamp(3),
	CONSTRAINT `ctv_ContentResourceResource_resourceOfId_resourceId_pk` PRIMARY KEY(`resourceOfId`,`resourceId`)
);
--> statement-breakpoint
CREATE TABLE `ctv_ContentResourceTag` (
	`contentResourceId` varchar(255) NOT NULL,
	`organizationId` varchar(191),
	`tagId` varchar(255) NOT NULL,
	`position` double NOT NULL DEFAULT 0,
	`createdAt` timestamp(3) DEFAULT CURRENT_TIMESTAMP(3),
	`updatedAt` timestamp(3) DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `ctv_ContentResourceTag_contentResourceId_tagId_pk` PRIMARY KEY(`contentResourceId`,`tagId`)
);
--> statement-breakpoint
CREATE TABLE `ctv_ContentResourceVersion` (
	`id` varchar(255) NOT NULL,
	`organizationId` varchar(191),
	`resourceId` varchar(255) NOT NULL,
	`parentVersionId` varchar(255),
	`versionNumber` int NOT NULL,
	`fields` json DEFAULT ('{}'),
	`createdAt` timestamp(3) DEFAULT CURRENT_TIMESTAMP(3),
	`createdById` varchar(255) NOT NULL,
	CONSTRAINT `ctv_ContentResourceVersion_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_resource_version_number` UNIQUE(`resourceId`,`versionNumber`)
);
--> statement-breakpoint
CREATE TABLE `ctv_ContributionType` (
	`id` varchar(255) NOT NULL,
	`organizationId` varchar(191),
	`slug` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp(3) DEFAULT (now()),
	`updatedAt` timestamp(3) DEFAULT (now()),
	`deletedAt` timestamp(3),
	CONSTRAINT `ctv_ContributionType_id` PRIMARY KEY(`id`),
	CONSTRAINT `ctv_ContributionType_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `ctv_Coupon` (
	`id` varchar(191) NOT NULL,
	`organizationId` varchar(191),
	`code` varchar(191),
	`createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`expires` timestamp(3),
	`fields` json DEFAULT ('{}'),
	`maxUses` int NOT NULL DEFAULT -1,
	`default` boolean NOT NULL DEFAULT false,
	`merchantCouponId` varchar(191),
	`status` int NOT NULL DEFAULT 0,
	`usedCount` int NOT NULL DEFAULT 0,
	`percentageDiscount` decimal(3,2),
	`amountDiscount` int,
	`restrictedToProductId` varchar(191),
	CONSTRAINT `Coupon_id` PRIMARY KEY(`id`),
	CONSTRAINT `Coupon_code_key` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `ctv_DeviceAccessToken` (
	`token` varchar(191) NOT NULL,
	`userId` varchar(191) NOT NULL,
	`organizationMembershipId` varchar(191),
	`createdAt` timestamp(3) DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `ctv_DeviceAccessToken_token_pk` PRIMARY KEY(`token`)
);
--> statement-breakpoint
CREATE TABLE `ctv_DeviceVerification` (
	`verifiedByUserId` varchar(255),
	`deviceCode` varchar(191) NOT NULL,
	`userCode` text NOT NULL,
	`expires` timestamp(3) NOT NULL,
	`createdAt` timestamp(3) DEFAULT CURRENT_TIMESTAMP(3),
	`verifiedAt` timestamp(3),
	CONSTRAINT `ctv_DeviceVerification_deviceCode_pk` PRIMARY KEY(`deviceCode`)
);
--> statement-breakpoint
CREATE TABLE `ctv_EntitlementType` (
	`id` varchar(191) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	CONSTRAINT `ctv_EntitlementType_id` PRIMARY KEY(`id`),
	CONSTRAINT `unique_name_idx` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `ctv_Entitlement` (
	`id` varchar(191) NOT NULL,
	`entitlementType` varchar(255) NOT NULL,
	`userId` varchar(191),
	`organizationId` varchar(191),
	`organizationMembershipId` varchar(191),
	`sourceType` varchar(255) NOT NULL,
	`sourceId` varchar(191) NOT NULL,
	`metadata` json DEFAULT ('{}'),
	`expiresAt` timestamp(3),
	`createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updatedAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`deletedAt` timestamp(3),
	CONSTRAINT `ctv_Entitlement_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ctv_LessonProgress` (
	`id` varchar(191) NOT NULL,
	`userId` varchar(191) NOT NULL,
	`organizationId` varchar(191),
	`organizationMembershipId` varchar(191),
	`lessonId` varchar(191),
	`lessonSlug` varchar(191),
	`lessonVersion` varchar(191),
	`sectionId` varchar(191),
	`moduleId` varchar(191),
	`completedAt` datetime(3),
	`updatedAt` datetime(3),
	`createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `ctv_LessonProgress_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ctv_MerchantAccount` (
	`id` varchar(191) NOT NULL,
	`organizationId` varchar(191),
	`status` int NOT NULL DEFAULT 0,
	`createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`label` varchar(191),
	`identifier` varchar(191),
	CONSTRAINT `MerchantAccount_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ctv_MerchantCharge` (
	`id` varchar(191) NOT NULL,
	`organizationId` varchar(191),
	`status` int NOT NULL DEFAULT 0,
	`identifier` varchar(191) NOT NULL,
	`userId` varchar(191) NOT NULL,
	`merchantAccountId` varchar(191) NOT NULL,
	`merchantProductId` varchar(191) NOT NULL,
	`merchantSubscriptionId` varchar(191),
	`createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`merchantCustomerId` varchar(191) NOT NULL,
	CONSTRAINT `MerchantCharge_id` PRIMARY KEY(`id`),
	CONSTRAINT `MerchantCharge_identifier_key` UNIQUE(`identifier`)
);
--> statement-breakpoint
CREATE TABLE `ctv_MerchantCoupon` (
	`id` varchar(191) NOT NULL,
	`identifier` varchar(191),
	`organizationId` varchar(191),
	`status` int NOT NULL DEFAULT 0,
	`merchantAccountId` varchar(191) NOT NULL,
	`percentageDiscount` decimal(3,2),
	`amountDiscount` int,
	`type` varchar(191),
	CONSTRAINT `MerchantCoupon_id` PRIMARY KEY(`id`),
	CONSTRAINT `MerchantCoupon_identifier_key` UNIQUE(`identifier`)
);
--> statement-breakpoint
CREATE TABLE `ctv_MerchantCustomer` (
	`id` varchar(191) NOT NULL,
	`organizationId` varchar(191),
	`userId` varchar(191) NOT NULL,
	`merchantAccountId` varchar(191) NOT NULL,
	`identifier` varchar(191) NOT NULL,
	`createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`status` int DEFAULT 0,
	CONSTRAINT `MerchantCustomer_id` PRIMARY KEY(`id`),
	CONSTRAINT `MerchantCustomer_identifier_key` UNIQUE(`identifier`)
);
--> statement-breakpoint
CREATE TABLE `ctv_MerchantEvents` (
	`id` varchar(191) NOT NULL,
	`merchantAccountId` varchar(191) NOT NULL,
	`identifier` varchar(191) NOT NULL,
	`payload` json NOT NULL,
	`createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `MerchantEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `MerchantEvents_identifier_key` UNIQUE(`identifier`)
);
--> statement-breakpoint
CREATE TABLE `ctv_MerchantPrice` (
	`id` varchar(191) NOT NULL,
	`organizationId` varchar(191),
	`merchantAccountId` varchar(191) NOT NULL,
	`merchantProductId` varchar(191) NOT NULL,
	`status` int DEFAULT 0,
	`identifier` varchar(191),
	`createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`priceId` varchar(191),
	CONSTRAINT `MerchantPrice_id` PRIMARY KEY(`id`),
	CONSTRAINT `MerchantPrice_identifier_key` UNIQUE(`identifier`)
);
--> statement-breakpoint
CREATE TABLE `ctv_MerchantProduct` (
	`id` varchar(191) NOT NULL,
	`organizationId` varchar(191),
	`merchantAccountId` varchar(191) NOT NULL,
	`productId` varchar(191) NOT NULL,
	`status` int NOT NULL DEFAULT 0,
	`identifier` varchar(191),
	`createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `MerchantProduct_id` PRIMARY KEY(`id`),
	CONSTRAINT `MerchantProduct_identifier_key` UNIQUE(`identifier`)
);
--> statement-breakpoint
CREATE TABLE `ctv_MerchantSession` (
	`id` varchar(191) NOT NULL,
	`organizationId` varchar(191),
	`identifier` varchar(191) NOT NULL,
	`merchantAccountId` varchar(191) NOT NULL,
	CONSTRAINT `MerchantSession_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ctv_MerchantSubscription` (
	`id` varchar(191) NOT NULL,
	`organizationId` varchar(191),
	`merchantAccountId` varchar(191) NOT NULL,
	`status` int NOT NULL DEFAULT 0,
	`createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`label` varchar(191),
	`identifier` varchar(191),
	`merchantCustomerId` varchar(191) NOT NULL,
	`merchantProductId` varchar(191) NOT NULL,
	CONSTRAINT `MerchantSubscription_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ctv_Organization` (
	`id` varchar(255) NOT NULL,
	`name` varchar(255),
	`fields` json DEFAULT ('{}'),
	`image` varchar(255),
	`createdAt` timestamp(3) DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `ctv_Organization_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ctv_OrganizationMembershipRole` (
	`organizationMembershipId` varchar(255) NOT NULL,
	`roleId` varchar(255) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`organizationId` varchar(191),
	`createdAt` timestamp(3) DEFAULT (now()),
	`updatedAt` timestamp(3) DEFAULT (now()),
	`deletedAt` timestamp(3),
	CONSTRAINT `pk` PRIMARY KEY(`organizationMembershipId`,`roleId`)
);
--> statement-breakpoint
CREATE TABLE `ctv_OrganizationMembership` (
	`id` varchar(255) NOT NULL,
	`organizationId` varchar(191),
	`role` varchar(191) NOT NULL DEFAULT 'user',
	`invitedById` varchar(255) NOT NULL,
	`userId` varchar(255) NOT NULL,
	`fields` json DEFAULT ('{}'),
	`createdAt` timestamp(3) DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `ctv_OrganizationMembership_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ctv_Permission` (
	`id` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp(3) DEFAULT (now()),
	`updatedAt` timestamp(3) DEFAULT (now()),
	`deletedAt` timestamp(3),
	CONSTRAINT `ctv_Permission_id` PRIMARY KEY(`id`),
	CONSTRAINT `ctv_Permission_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `ctv_Price` (
	`id` varchar(191) NOT NULL,
	`productId` varchar(191),
	`organizationId` varchar(191),
	`nickname` varchar(191),
	`status` int NOT NULL DEFAULT 0,
	`unitAmount` decimal(10,2) NOT NULL,
	`createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`fields` json DEFAULT ('{}'),
	CONSTRAINT `Price_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ctv_Product` (
	`id` varchar(191) NOT NULL,
	`organizationId` varchar(191),
	`name` varchar(191) NOT NULL,
	`key` varchar(191),
	`type` varchar(191),
	`fields` json DEFAULT ('{}'),
	`createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`status` int NOT NULL DEFAULT 0,
	`quantityAvailable` int NOT NULL DEFAULT -1,
	CONSTRAINT `Product_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ctv_Profile` (
	`id` varchar(255) NOT NULL,
	`userId` varchar(255) NOT NULL,
	`type` varchar(255) NOT NULL,
	`fields` json DEFAULT ('{}'),
	`createdAt` timestamp(3) DEFAULT CURRENT_TIMESTAMP(3),
	`updatedAt` timestamp(3) DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `ctv_Profile_id` PRIMARY KEY(`id`),
	CONSTRAINT `unique_user_type_idx` UNIQUE(`userId`,`type`)
);
--> statement-breakpoint
CREATE TABLE `ctv_PurchaseUserTransfer` (
	`id` varchar(191) NOT NULL,
	`transferState` enum('AVAILABLE','INITIATED','VERIFIED','CANCELED','EXPIRED','CONFIRMED','COMPLETED') NOT NULL DEFAULT 'AVAILABLE',
	`purchaseId` varchar(191) NOT NULL,
	`organizationId` varchar(191),
	`sourceUserId` varchar(191) NOT NULL,
	`targetUserId` varchar(191),
	`createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`expiresAt` timestamp(3),
	`canceledAt` timestamp(3),
	`confirmedAt` timestamp(3),
	`completedAt` timestamp(3),
	CONSTRAINT `PurchaseUserTransfer_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ctv_Purchase` (
	`id` varchar(191) NOT NULL,
	`userId` varchar(191),
	`organizationMembershipId` varchar(191),
	`organizationId` varchar(191),
	`createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`totalAmount` decimal(65,30) NOT NULL,
	`ip_address` varchar(191),
	`city` varchar(191),
	`state` varchar(191),
	`country` varchar(191),
	`couponId` varchar(191),
	`productId` varchar(191) NOT NULL,
	`merchantChargeId` varchar(191),
	`upgradedFromId` varchar(191),
	`status` varchar(191) NOT NULL DEFAULT 'Valid',
	`bulkCouponId` varchar(191),
	`merchantSessionId` varchar(191),
	`redeemedBulkCouponId` varchar(191),
	`fields` json DEFAULT ('{}'),
	CONSTRAINT `Purchase_id` PRIMARY KEY(`id`),
	CONSTRAINT `Purchase_upgradedFromId_key` UNIQUE(`upgradedFromId`)
);
--> statement-breakpoint
CREATE TABLE `ctv_QuestionResponse` (
	`id` varchar(255) NOT NULL,
	`surveyId` varchar(255) NOT NULL,
	`questionId` varchar(255) NOT NULL,
	`respondentKey` varchar(255),
	`surveySessionId` varchar(255),
	`userId` varchar(255),
	`emailListSubscriberId` varchar(255),
	`fields` json DEFAULT ('{}'),
	`createdAt` timestamp(3) DEFAULT CURRENT_TIMESTAMP(3),
	`updatedAt` timestamp(3) DEFAULT CURRENT_TIMESTAMP(3),
	`deletedAt` timestamp(3),
	CONSTRAINT `ctv_QuestionResponse_id` PRIMARY KEY(`id`),
	CONSTRAINT `survey_question_respondent_unique` UNIQUE(`surveyId`,`questionId`,`respondentKey`)
);
--> statement-breakpoint
CREATE TABLE `ctv_ResourceProgress` (
	`userId` varchar(255) NOT NULL,
	`organizationId` varchar(191),
	`organizationMembershipId` varchar(191),
	`resourceId` varchar(255) NOT NULL,
	`fields` json DEFAULT ('{}'),
	`completedAt` datetime(3),
	`updatedAt` datetime(3),
	`createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `ctv_ResourceProgress_userId_resourceId_pk` PRIMARY KEY(`userId`,`resourceId`)
);
--> statement-breakpoint
CREATE TABLE `ctv_RolePermission` (
	`roleId` varchar(255) NOT NULL,
	`permissionId` varchar(255) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp(3) DEFAULT (now()),
	`updatedAt` timestamp(3) DEFAULT (now()),
	`deletedAt` timestamp(3),
	CONSTRAINT `ctv_RolePermission_roleId_permissionId_pk` PRIMARY KEY(`roleId`,`permissionId`)
);
--> statement-breakpoint
CREATE TABLE `ctv_Role` (
	`id` varchar(255) NOT NULL,
	`organizationId` varchar(191),
	`name` varchar(255) NOT NULL,
	`description` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp(3) DEFAULT (now()),
	`updatedAt` timestamp(3) DEFAULT (now()),
	`deletedAt` timestamp(3),
	CONSTRAINT `ctv_Role_id` PRIMARY KEY(`id`),
	CONSTRAINT `unique_name_per_org` UNIQUE(`organizationId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `ctv_Session` (
	`sessionToken` varchar(255) NOT NULL,
	`userId` varchar(255) NOT NULL,
	`expires` timestamp NOT NULL,
	CONSTRAINT `ctv_Session_sessionToken` PRIMARY KEY(`sessionToken`)
);
--> statement-breakpoint
CREATE TABLE `ctv_Subscription` (
	`id` varchar(191) NOT NULL,
	`organizationId` varchar(191),
	`productId` varchar(191) NOT NULL,
	`createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`merchantSubscriptionId` varchar(191) NOT NULL,
	`status` varchar(191) NOT NULL DEFAULT 'active',
	`fields` json DEFAULT ('{}'),
	CONSTRAINT `Subscription_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ctv_Tag` (
	`id` varchar(255) NOT NULL,
	`organizationId` varchar(191),
	`type` varchar(255) NOT NULL,
	`fields` json DEFAULT ('{}'),
	`createdAt` timestamp(3) DEFAULT CURRENT_TIMESTAMP(3),
	`updatedAt` timestamp(3) DEFAULT CURRENT_TIMESTAMP(3),
	`deletedAt` timestamp(3),
	CONSTRAINT `ctv_Tag_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ctv_TagTag` (
	`parentTagId` varchar(255) NOT NULL,
	`childTagId` varchar(255) NOT NULL,
	`position` double NOT NULL DEFAULT 0,
	`metadata` json DEFAULT ('{}'),
	`organizationId` varchar(191),
	`createdAt` timestamp(3) DEFAULT CURRENT_TIMESTAMP(3),
	`updatedAt` timestamp(3) DEFAULT CURRENT_TIMESTAMP(3),
	`deletedAt` timestamp(3),
	CONSTRAINT `ctv_TagTag_parentTagId_childTagId_pk` PRIMARY KEY(`parentTagId`,`childTagId`)
);
--> statement-breakpoint
CREATE TABLE `ctv_UpgradableProducts` (
	`upgradableToId` varchar(255) NOT NULL,
	`upgradableFrom` varchar(255) NOT NULL,
	`organizationId` varchar(191),
	`position` double NOT NULL DEFAULT 0,
	`metadata` json DEFAULT ('{}'),
	`createdAt` timestamp(3) DEFAULT CURRENT_TIMESTAMP(3),
	`updatedAt` timestamp(3) DEFAULT CURRENT_TIMESTAMP(3),
	`deletedAt` timestamp(3),
	CONSTRAINT `ctv_UpgradableProducts_upgradableToId_upgradableFrom_pk` PRIMARY KEY(`upgradableToId`,`upgradableFrom`)
);
--> statement-breakpoint
CREATE TABLE `ctv_UserPermission` (
	`userId` varchar(255) NOT NULL,
	`organizationId` varchar(191),
	`permissionId` varchar(255) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp(3) DEFAULT (now()),
	`updatedAt` timestamp(3) DEFAULT (now()),
	`deletedAt` timestamp(3),
	CONSTRAINT `ctv_UserPermission_userId_permissionId_pk` PRIMARY KEY(`userId`,`permissionId`)
);
--> statement-breakpoint
CREATE TABLE `ctv_UserPrefs` (
	`id` varchar(191) NOT NULL,
	`organizationId` varchar(191),
	`type` varchar(191) NOT NULL DEFAULT 'Global',
	`userId` varchar(255) NOT NULL,
	`fields` json DEFAULT ('{}'),
	`createdAt` timestamp(3) DEFAULT CURRENT_TIMESTAMP(3),
	`updatedAt` timestamp(3) DEFAULT CURRENT_TIMESTAMP(3),
	`deletedAt` timestamp(3),
	CONSTRAINT `ctv_UserPrefs_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ctv_UserRole` (
	`userId` varchar(255) NOT NULL,
	`roleId` varchar(255) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`organizationId` varchar(191),
	`createdAt` timestamp(3) DEFAULT (now()),
	`updatedAt` timestamp(3) DEFAULT (now()),
	`deletedAt` timestamp(3),
	CONSTRAINT `ctv_UserRole_userId_roleId_pk` PRIMARY KEY(`userId`,`roleId`)
);
--> statement-breakpoint
CREATE TABLE `ctv_User` (
	`id` varchar(255) NOT NULL,
	`name` varchar(255),
	`role` varchar(191) NOT NULL DEFAULT 'user',
	`email` varchar(255) NOT NULL,
	`fields` json DEFAULT ('{}'),
	`externalId` varchar(255) GENERATED ALWAYS AS ((fields->>'$.externalId')) STORED,
	`emailVerified` timestamp(3),
	`image` varchar(255),
	`createdAt` timestamp(3) DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `ctv_User_id` PRIMARY KEY(`id`),
	CONSTRAINT `ctv_User_email_unique` UNIQUE(`email`),
	CONSTRAINT `external_id_idx` UNIQUE(`externalId`)
);
--> statement-breakpoint
CREATE TABLE `ctv_VerificationToken` (
	`identifier` varchar(255) NOT NULL,
	`token` varchar(255) NOT NULL,
	`expires` timestamp NOT NULL,
	`createdAt` timestamp(3) DEFAULT (now()),
	CONSTRAINT `ctv_VerificationToken_identifier_token_pk` PRIMARY KEY(`identifier`,`token`)
);
--> statement-breakpoint
CREATE INDEX `userId_idx` ON `ctv_Account` (`userId`);--> statement-breakpoint
CREATE INDEX `crr_userIdId_idx` ON `ctv_Comment` (`userId`);--> statement-breakpoint
CREATE INDEX `organizationMembershipId_idx` ON `ctv_Comment` (`organizationMembershipId`);--> statement-breakpoint
CREATE INDEX `name_idx` ON `ctv_CommunicationChannel` (`name`);--> statement-breakpoint
CREATE INDEX `organizationId_idx` ON `ctv_CommunicationChannel` (`organizationId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `ctv_CommunicationPreference` (`userId`);--> statement-breakpoint
CREATE INDEX `preferenceTypeId_idx` ON `ctv_CommunicationPreference` (`preferenceTypeId`);--> statement-breakpoint
CREATE INDEX `channelId_idx` ON `ctv_CommunicationPreference` (`channelId`);--> statement-breakpoint
CREATE INDEX `organizationMembershipId_idx` ON `ctv_CommunicationPreference` (`organizationMembershipId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `ctv_ContentContribution` (`userId`);--> statement-breakpoint
CREATE INDEX `contentId_idx` ON `ctv_ContentContribution` (`contentId`);--> statement-breakpoint
CREATE INDEX `contributionTypeId_idx` ON `ctv_ContentContribution` (`contributionTypeId`);--> statement-breakpoint
CREATE INDEX `organizationMembershipId_idx` ON `ctv_ContentContribution` (`organizationMembershipId`);--> statement-breakpoint
CREATE INDEX `type_idx` ON `ctv_ContentResource` (`type`);--> statement-breakpoint
CREATE INDEX `createdById_idx` ON `ctv_ContentResource` (`createdById`);--> statement-breakpoint
CREATE INDEX `createdAt_idx` ON `ctv_ContentResource` (`createdAt`);--> statement-breakpoint
CREATE INDEX `currentVersionId_idx` ON `ctv_ContentResource` (`currentVersionId`);--> statement-breakpoint
CREATE INDEX `createdByOrganizationMembershipId_idx` ON `ctv_ContentResource` (`createdByOrganizationMembershipId`);--> statement-breakpoint
CREATE INDEX `slug_idx` ON `ctv_ContentResource` (`slug`);--> statement-breakpoint
CREATE INDEX `contentResourceId_idx` ON `ctv_ContentResourceProduct` (`productId`);--> statement-breakpoint
CREATE INDEX `resourceId_idx` ON `ctv_ContentResourceProduct` (`resourceId`);--> statement-breakpoint
CREATE INDEX `organizationId_idx` ON `ctv_ContentResourceProduct` (`organizationId`);--> statement-breakpoint
CREATE INDEX `contentResourceId_idx` ON `ctv_ContentResourceResource` (`resourceOfId`);--> statement-breakpoint
CREATE INDEX `resourceId_idx` ON `ctv_ContentResourceResource` (`resourceId`);--> statement-breakpoint
CREATE INDEX `organizationId_idx` ON `ctv_ContentResourceResource` (`organizationId`);--> statement-breakpoint
CREATE INDEX `contentResourceId_idx` ON `ctv_ContentResourceTag` (`contentResourceId`);--> statement-breakpoint
CREATE INDEX `tagId_idx` ON `ctv_ContentResourceTag` (`tagId`);--> statement-breakpoint
CREATE INDEX `position_idx` ON `ctv_ContentResourceTag` (`position`);--> statement-breakpoint
CREATE INDEX `organizationId_idx` ON `ctv_ContentResourceTag` (`organizationId`);--> statement-breakpoint
CREATE INDEX `resourceId_idx` ON `ctv_ContentResourceVersion` (`resourceId`);--> statement-breakpoint
CREATE INDEX `parentVersionId_idx` ON `ctv_ContentResourceVersion` (`parentVersionId`);--> statement-breakpoint
CREATE INDEX `resourceId_versionNumber_idx` ON `ctv_ContentResourceVersion` (`resourceId`,`versionNumber`);--> statement-breakpoint
CREATE INDEX `organizationId_idx` ON `ctv_ContentResourceVersion` (`organizationId`);--> statement-breakpoint
CREATE INDEX `name_idx` ON `ctv_ContributionType` (`name`);--> statement-breakpoint
CREATE INDEX `slug_idx` ON `ctv_ContributionType` (`slug`);--> statement-breakpoint
CREATE INDEX `organizationId_idx` ON `ctv_ContributionType` (`organizationId`);--> statement-breakpoint
CREATE INDEX `Coupon_id_code_index` ON `ctv_Coupon` (`id`,`code`);--> statement-breakpoint
CREATE INDEX `organizationId_idx` ON `ctv_Coupon` (`organizationId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `ctv_DeviceAccessToken` (`userId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `ctv_Entitlement` (`userId`);--> statement-breakpoint
CREATE INDEX `orgId_idx` ON `ctv_Entitlement` (`organizationId`);--> statement-breakpoint
CREATE INDEX `source_idx` ON `ctv_Entitlement` (`sourceType`,`sourceId`);--> statement-breakpoint
CREATE INDEX `type_idx` ON `ctv_Entitlement` (`entitlementType`);--> statement-breakpoint
CREATE INDEX `crp_userId_contentResourceId_idx` ON `ctv_LessonProgress` (`userId`,`lessonId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `ctv_LessonProgress` (`userId`);--> statement-breakpoint
CREATE INDEX `lessonId_idx` ON `ctv_LessonProgress` (`lessonId`);--> statement-breakpoint
CREATE INDEX `organizationMembershipId_idx` ON `ctv_LessonProgress` (`organizationMembershipId`);--> statement-breakpoint
CREATE INDEX `organizationId_idx` ON `ctv_MerchantAccount` (`organizationId`);--> statement-breakpoint
CREATE INDEX `merchantSubscriptionId_idx` ON `ctv_MerchantCharge` (`merchantSubscriptionId`);--> statement-breakpoint
CREATE INDEX `organizationId_idx` ON `ctv_MerchantCharge` (`organizationId`);--> statement-breakpoint
CREATE INDEX `organizationId_idx` ON `ctv_MerchantCoupon` (`organizationId`);--> statement-breakpoint
CREATE INDEX `idx_MerchantCustomer_on_userId` ON `ctv_MerchantCustomer` (`userId`);--> statement-breakpoint
CREATE INDEX `organizationId_idx` ON `ctv_MerchantCustomer` (`organizationId`);--> statement-breakpoint
CREATE INDEX `merchantAccountId_idx` ON `ctv_MerchantEvents` (`merchantAccountId`);--> statement-breakpoint
CREATE INDEX `createdAt_idx` ON `ctv_MerchantEvents` (`createdAt`);--> statement-breakpoint
CREATE INDEX `organizationId_idx` ON `ctv_MerchantPrice` (`organizationId`);--> statement-breakpoint
CREATE INDEX `organizationId_idx` ON `ctv_MerchantProduct` (`organizationId`);--> statement-breakpoint
CREATE INDEX `organizationId_idx` ON `ctv_MerchantSession` (`organizationId`);--> statement-breakpoint
CREATE INDEX `organizationId_idx` ON `ctv_MerchantSubscription` (`organizationId`);--> statement-breakpoint
CREATE INDEX `created_at_idx` ON `ctv_Organization` (`createdAt`);--> statement-breakpoint
CREATE INDEX `orgMemberId_idx` ON `ctv_OrganizationMembershipRole` (`organizationMembershipId`);--> statement-breakpoint
CREATE INDEX `roleId_idx` ON `ctv_OrganizationMembershipRole` (`roleId`);--> statement-breakpoint
CREATE INDEX `organizationId_idx` ON `ctv_OrganizationMembershipRole` (`organizationId`);--> statement-breakpoint
CREATE INDEX `role_idx` ON `ctv_OrganizationMembership` (`role`);--> statement-breakpoint
CREATE INDEX `created_at_idx` ON `ctv_OrganizationMembership` (`createdAt`);--> statement-breakpoint
CREATE INDEX `organizationId_idx` ON `ctv_OrganizationMembership` (`organizationId`);--> statement-breakpoint
CREATE INDEX `name_idx` ON `ctv_Permission` (`name`);--> statement-breakpoint
CREATE INDEX `organizationId_idx` ON `ctv_Price` (`organizationId`);--> statement-breakpoint
CREATE INDEX `organizationId_idx` ON `ctv_Product` (`organizationId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `ctv_Profile` (`userId`);--> statement-breakpoint
CREATE INDEX `organizationId_idx` ON `ctv_PurchaseUserTransfer` (`organizationId`);--> statement-breakpoint
CREATE INDEX `idx_Purchase_on_merchantChargeId` ON `ctv_Purchase` (`merchantChargeId`);--> statement-breakpoint
CREATE INDEX `organizationId_idx` ON `ctv_Purchase` (`organizationId`);--> statement-breakpoint
CREATE INDEX `organizationMembershipId_idx` ON `ctv_Purchase` (`organizationMembershipId`);--> statement-breakpoint
CREATE INDEX `surveyId_idx` ON `ctv_QuestionResponse` (`surveyId`);--> statement-breakpoint
CREATE INDEX `questionId_idx` ON `ctv_QuestionResponse` (`questionId`);--> statement-breakpoint
CREATE INDEX `respondent_key_idx` ON `ctv_QuestionResponse` (`respondentKey`);--> statement-breakpoint
CREATE INDEX `survey_session_id_idx` ON `ctv_QuestionResponse` (`surveySessionId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `ctv_QuestionResponse` (`userId`);--> statement-breakpoint
CREATE INDEX `emailListSubscriberId_idx` ON `ctv_QuestionResponse` (`emailListSubscriberId`);--> statement-breakpoint
CREATE INDEX `survey_subscriber_idx` ON `ctv_QuestionResponse` (`surveyId`,`emailListSubscriberId`);--> statement-breakpoint
CREATE INDEX `crp_userId_contentResourceId_idx` ON `ctv_ResourceProgress` (`userId`,`resourceId`);--> statement-breakpoint
CREATE INDEX `contentResourceId_idx` ON `ctv_ResourceProgress` (`resourceId`);--> statement-breakpoint
CREATE INDEX `resourceId_idx` ON `ctv_ResourceProgress` (`userId`);--> statement-breakpoint
CREATE INDEX `organizationMembershipId_idx` ON `ctv_ResourceProgress` (`organizationMembershipId`);--> statement-breakpoint
CREATE INDEX `roleId_idx` ON `ctv_RolePermission` (`roleId`);--> statement-breakpoint
CREATE INDEX `permissionId_idx` ON `ctv_RolePermission` (`permissionId`);--> statement-breakpoint
CREATE INDEX `name_idx` ON `ctv_Role` (`name`);--> statement-breakpoint
CREATE INDEX `organizationId_idx` ON `ctv_Role` (`organizationId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `ctv_Session` (`userId`);--> statement-breakpoint
CREATE INDEX `organizationId_idx` ON `ctv_Subscription` (`organizationId`);--> statement-breakpoint
CREATE INDEX `type_idx` ON `ctv_Tag` (`type`);--> statement-breakpoint
CREATE INDEX `organizationId_idx` ON `ctv_Tag` (`organizationId`);--> statement-breakpoint
CREATE INDEX `parentTagId_idx` ON `ctv_TagTag` (`parentTagId`);--> statement-breakpoint
CREATE INDEX `childTagId_idx` ON `ctv_TagTag` (`childTagId`);--> statement-breakpoint
CREATE INDEX `position_idx` ON `ctv_TagTag` (`position`);--> statement-breakpoint
CREATE INDEX `organizationId_idx` ON `ctv_TagTag` (`organizationId`);--> statement-breakpoint
CREATE INDEX `upgradableFromId_idx` ON `ctv_UpgradableProducts` (`upgradableToId`);--> statement-breakpoint
CREATE INDEX `upgradableToId_idx` ON `ctv_UpgradableProducts` (`upgradableFrom`);--> statement-breakpoint
CREATE INDEX `organizationId_idx` ON `ctv_UpgradableProducts` (`organizationId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `ctv_UserPermission` (`userId`);--> statement-breakpoint
CREATE INDEX `permissionId_idx` ON `ctv_UserPermission` (`permissionId`);--> statement-breakpoint
CREATE INDEX `organizationId_idx` ON `ctv_UserPermission` (`organizationId`);--> statement-breakpoint
CREATE INDEX `crr_userIdId_idx` ON `ctv_UserPrefs` (`userId`);--> statement-breakpoint
CREATE INDEX `organizationId_idx` ON `ctv_UserPrefs` (`organizationId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `ctv_UserRole` (`userId`);--> statement-breakpoint
CREATE INDEX `roleId_idx` ON `ctv_UserRole` (`roleId`);--> statement-breakpoint
CREATE INDEX `organizationId_idx` ON `ctv_UserRole` (`organizationId`);--> statement-breakpoint
CREATE INDEX `email_idx` ON `ctv_User` (`email`);--> statement-breakpoint
CREATE INDEX `role_idx` ON `ctv_User` (`role`);--> statement-breakpoint
CREATE INDEX `created_at_idx` ON `ctv_User` (`createdAt`);