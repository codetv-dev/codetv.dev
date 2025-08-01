// TODO figure out how to get these types into @codetv/types in a way that actually works.

type Subscription = {
	status: Stripe.Subscription.Status;
	level: string;
	customer: Stripe.Customer | Stripe.DeletedCustomer | string;
};

declare interface UserPublicMetadata {
	stripe?: Subscription;
}

type UserMetadataParams = {
	publicMetadata?: UserPublicMetadata;
	privateMetadata?: UserPrivateMetadata;
	unsafeMetadata?: UserUnsafeMetadata;
};
type PasswordHasher =
	| 'argon2i'
	| 'argon2id'
	| 'awscognito'
	| 'bcrypt'
	| 'bcrypt_sha256_django'
	| 'md5'
	| 'pbkdf2_sha256'
	| 'pbkdf2_sha256_django'
	| 'pbkdf2_sha1'
	| 'phpass'
	| 'scrypt_firebase'
	| 'scrypt_werkzeug'
	| 'sha256'
	| 'md5_phpass'
	| 'ldap_ssha';
type UserPasswordHashingParams = {
	passwordDigest: string;
	passwordHasher: PasswordHasher;
};
type CreateUserParams = {
	externalId?: string;
	emailAddress?: string[];
	phoneNumber?: string[];
	username?: string;
	password?: string;
	firstName?: string;
	lastName?: string;
	skipPasswordChecks?: boolean;
	skipPasswordRequirement?: boolean;
	skipLegalChecks?: boolean;
	legalAcceptedAt?: Date;
	totpSecret?: string;
	backupCodes?: string[];
	createdAt?: Date;
} & UserMetadataParams &
	(UserPasswordHashingParams | object);
