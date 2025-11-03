export const ROLES = {
	CEO: 'ceo',
	ADMIN: 'admin',
	RH_COMPRAS: 'rh_compras',
	ESTRATEGIA_DESARROLLO: 'estrategia_desarrollo',
	FINANZAS: 'finanzas',
	IT: 'it',
	USUARIO: 'user',
} as const;

// Permisos por recurso
// Acciones: read | write | manage
export const ROLE_PERMISSIONS: Record<string, Record<string, ('read'|'write'|'manage')[]>> = {
	[ROLES.CEO]: { '*': ['manage'] },
	[ROLES.ADMIN]: { '*': ['manage'] },
	// Permisos para roles de contactos (salma, francisco, desarrollo_estrategia_inrra, boss)
	'salma': { projects: ['read'], tasks: ['read'] },
	'francisco': { projects: ['read'], tasks: ['read'] },
	'desarrollo_estrategia_inrra': { projects: ['read', 'write'], tasks: ['read', 'write'] },
	'boss': { projects: ['read'], tasks: ['read'] },
	'ceo': { projects: ['read'], tasks: ['read'] },
	[ROLES.RH_COMPRAS]: {
		requests: ['manage']
	},
	[ROLES.ESTRATEGIA_DESARROLLO]: {
		projects: ['read','write'],
		tasks: ['read','write']
	},
	[ROLES.FINANZAS]: {
		inventory: ['read'],
		reports: ['read']
	},
	[ROLES.IT]: {
		projects: ['read','write'],
		tasks: ['read','write'],
		tickets: ['manage']
	},
	[ROLES.USUARIO]: {
		projects: ['read'],
		tasks: ['read']
	}
};


