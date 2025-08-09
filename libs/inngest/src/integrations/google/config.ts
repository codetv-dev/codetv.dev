export const config = {
	// these get replaced during build to work around the 4KB Lambda env limit
	auth: {
		serviceAccount: '${GOOGLE_API_SERVICE_ACCOUNT}',
		// we need the double quotes for this replacement
		// prettier-ignore
		privateKey: "${GOOGLE_API_PRIVATE_KEY}",
	},
	calendar: {
		// this is the calendar that anyone can subscribe to for LWJ events
		public: {
			id: 'lengstorf.com_9plj1m6u9vtddldoinl0hs2vgk@group.calendar.google.com',
		},
		// this is Jason’s personal calendar, used only for free/busy checks
		host: {
			id: 'jason@codetv.dev',
		},
	},
	sheets: {
		filming: {
			id: '1ihOfKXacyKDmarkq1yrwSpodRvfncS-xpXSVJP5Zrnw',
			range: 'Sheet1!A2',
		},
		hackathon: {
			id: '', //Generate a new sheet
			range: 'Sheet1!A2',
		}
	},
};
