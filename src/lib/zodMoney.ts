import { z } from 'zod'
import { toPaise } from './money'

/** A Postgres numeric(12,2) as PostgREST returns it (number or string) -> integer paise. */
export const dbMoney = z.union([z.number(), z.string()]).transform((v) => toPaise(v))

export const dbMoneyNullable = dbMoney.nullable()
