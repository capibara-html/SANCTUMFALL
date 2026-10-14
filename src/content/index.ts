// Importing this module registers every piece of game content.
import './abilities';
import './units';
import './bosses/leviathan';
import './encounters/ashen-parish';
import './encounters/drowned-nave';

export const CAMPAIGN = ['ashen_parish', 'drowned_nave'] as const;
