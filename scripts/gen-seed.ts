import { products, categories } from '../src/data/products.ts'

function esc(s: string) {
  return s.replace(/'/g, "''")
}
function sqlStr(s: string | undefined | null) {
  return s == null ? 'null' : `'${esc(s)}'`
}
function sqlArr(a: string[] | undefined) {
  if (!a || a.length === 0) return 'null'
  return `array[${a.map((x) => `'${esc(x)}'`).join(',')}]`
}

const out: string[] = []
out.push('-- Seed gerado automaticamente a partir de src/data/products.ts')
out.push('-- (npm run gen:seed). Não editar à mão.')
out.push('')
out.push('insert into public.categories (id, label, sort) values')
out.push(
  categories
    .map((c, i) => `  (${sqlStr(c.id)}, ${sqlStr(c.label)}, ${i})`)
    .join(',\n') + '\non conflict (id) do update set label = excluded.label, sort = excluded.sort;',
)
out.push('')
out.push(
  'insert into public.products (id, name, category_id, kind, price, old_price, color_main, color_accent, badge, description, sizes, rating, reviews, stock, sort) values',
)
out.push(
  products
    .map((p, i) => {
      const vals = [
        sqlStr(p.id),
        sqlStr(p.name),
        sqlStr(p.category),
        sqlStr(p.kind),
        p.price,
        p.oldPrice ?? 'null',
        sqlStr(p.colors[0]),
        sqlStr(p.colors[1]),
        sqlStr(p.badge),
        sqlStr(p.description),
        sqlArr(p.sizes),
        p.rating,
        p.reviews,
        p.stock ?? 0,
        i,
      ]
      return `  (${vals.join(', ')})`
    })
    .join(',\n') +
    '\non conflict (id) do update set\n' +
    '  name = excluded.name, category_id = excluded.category_id, kind = excluded.kind,\n' +
    '  price = excluded.price, old_price = excluded.old_price, color_main = excluded.color_main,\n' +
    '  color_accent = excluded.color_accent, badge = excluded.badge, description = excluded.description,\n' +
    '  sizes = excluded.sizes, rating = excluded.rating, reviews = excluded.reviews,\n' +
    '  stock = excluded.stock, sort = excluded.sort;',
)
out.push('')
console.log(out.join('\n'))
