import {
  BLUE,
  BLUE_DARK,
  CREAM,
  GOLD,
  GOLD_DARK,
  NAVY,
  NAVY_DARK,
  PURPLE,
  PURPLE_DARK,
  RED,
  RED_DARK,
} from '../templates/colors'
import type { Color } from '../templates/draw'

export interface PackArt {
  body: Color
  stripe: Color
  ends: Color
  emblem: readonly string[]
  emblemColor: Color
}

export interface PackDef {
  id: string
  name: string
  /** One line for the shop's info box. */
  description: string
  /** Template ids this pack deals from. One id = three different rolls of that card. */
  pool: readonly string[]
  art: PackArt
}

// Jester's cap with bells (pack emblem).
const JESTER_CAP = ['10000000001', '11000100011', '01101110110', '00111111100', '00111111100', '01111111110']
const STAR = ['0001000', '0001000', '0011100', '1111111', '0011100', '0110110', '1100011']
const MOON = ['0011100', '0110000', '1100000', '1100000', '1100000', '0110000', '0011100']
const RINGED = ['000111000', '001111100', '111111111', '001111100', '000111000']

export const PACKS: readonly PackDef[] = [
  {
    id: 'classic',
    name: 'Classic Pack',
    description: '3 different cards from one photo, each with its own edition. Keep 1.',
    pool: ['stamp', 'voucher', 'ticket', 'trading', 'id'],
    art: { body: PURPLE, stripe: PURPLE_DARK, ends: GOLD_DARK, emblem: STAR, emblemColor: GOLD },
  },
  {
    id: 'arcana',
    name: 'Arcana Pack',
    description: '3 tarot cards, 3 different arcana. Keep 1.',
    pool: ['tarot'],
    art: { body: NAVY, stripe: NAVY_DARK, ends: GOLD, emblem: MOON, emblemColor: GOLD },
  },
  {
    id: 'cosmic',
    name: 'Cosmic Pack',
    description: '3 planet cards from across the galaxy. Keep 1.',
    pool: ['planet'],
    art: { body: NAVY_DARK, stripe: BLUE_DARK, ends: BLUE, emblem: RINGED, emblemColor: CREAM },
  },
  {
    id: 'jester',
    name: 'Joker Pack',
    description: '3 jokers with 3 different tricks. Keep 1.',
    pool: ['jester'],
    art: { body: RED, stripe: RED_DARK, ends: GOLD, emblem: JESTER_CAP, emblemColor: GOLD },
  },
]

export function getPack(id: string | null | undefined): PackDef {
  return PACKS.find((p) => p.id === id) ?? PACKS[0]
}
