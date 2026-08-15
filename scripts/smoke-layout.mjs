// Kiem tra engine cay layout ma khong can Electron.
// Node 24 tu strip type cho file .ts; tree.ts co dung `import type` nen khong
// can resolve alias @shared luc chay.
import {
  MIN_SPLIT_PCT,
  cloneLayout,
  collectLeaves,
  computeGeometry,
  leafCount,
  reconcile,
  removeLeaf,
  resizeSplit,
  rowLayout,
  splitLeaf
} from '../src/shared/layout.ts'

let failed = 0

function check(name, cond, detail) {
  if (cond) {
    console.log(`  ok    ${name}`)
  } else {
    failed += 1
    console.log(`  FAIL  ${name}${detail ? ` - ${detail}` : ''}`)
  }
}

function near(a, b, eps = 1e-6) {
  return Math.abs(a - b) < eps
}

/** Tong dien tich cac pane phai bang 100 va khong o nao chong lan o nao. */
function assertTiling(label, root) {
  const { panes } = computeGeometry(root)
  const rects = [...panes.values()]

  const area = rects.reduce((sum, r) => sum + (r.width * r.height) / 100, 0)
  check(`${label}: tong dien tich = 100%`, near(area, 100, 1e-9), `duoc ${area}`)

  const finite = rects.every(
    (r) =>
      Number.isFinite(r.left) &&
      Number.isFinite(r.top) &&
      Number.isFinite(r.width) &&
      Number.isFinite(r.height) &&
      r.width > 0 &&
      r.height > 0
  )
  check(`${label}: khong NaN, moi o deu > 0`, finite)

  let overlap = null
  for (let i = 0; i < rects.length && !overlap; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      const a = rects[i]
      const b = rects[j]
      const dx = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)
      const dy = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top)
      if (dx > 1e-9 && dy > 1e-9) {
        overlap = `${i} vs ${j}`
        break
      }
    }
  }
  check(`${label}: khong chong lan`, overlap === null, overlap)
}

console.log('\n[1] leaf don')
{
  const root = { kind: 'leaf', paneId: 'a' }
  assertTiling('1 pane', root)
  check('collectLeaves = [a]', collectLeaves(root).join() === 'a')
}

console.log('\n[2] split right')
{
  const root = splitLeaf({ kind: 'leaf', paneId: 'a' }, 'a', 'row', 'b')
  const { panes, dividers } = computeGeometry(root)
  const a = panes.get('a')
  const b = panes.get('b')
  check('a chiem nua trai', near(a.left, 0) && near(a.width, 50) && near(a.height, 100))
  check('b chiem nua phai', near(b.left, 50) && near(b.width, 50))
  check('co 1 divider doc', dividers.length === 1 && dividers[0].direction === 'row')
  check('divider o giua', near(dividers[0].left, 50) && near(dividers[0].spanPct, 100))
  assertTiling('2 cot', root)
}

console.log('\n[3] split down')
{
  const root = splitLeaf({ kind: 'leaf', paneId: 'a' }, 'a', 'column', 'b')
  const { panes, dividers } = computeGeometry(root)
  check('b nam duoi', near(panes.get('b').top, 50) && near(panes.get('b').height, 50))
  check('divider ngang', dividers[0].direction === 'column' && near(dividers[0].top, 50))
  assertTiling('2 hang', root)
}

console.log('\n[4] split cung chieu -> phang cay, khong long them')
{
  let root = splitLeaf({ kind: 'leaf', paneId: 'a' }, 'a', 'row', 'b')
  root = splitLeaf(root, 'b', 'row', 'c')
  check('root van la 1 split', root.kind === 'split' && root.children.length === 3)
  check('moi con deu la leaf', root.children.every((c) => c.kind === 'leaf'))
  check('thu tu a,b,c', collectLeaves(root).join() === 'a,b,c')
  const { panes } = computeGeometry(root)
  check('a giu 50%', near(panes.get('a').width, 50))
  check('b va c moi ben 25%', near(panes.get('b').width, 25) && near(panes.get('c').width, 25))
  assertTiling('3 cot khong deu', root)
}

console.log('\n[5] split khac chieu -> long split moi, chi pane do bi chia')
{
  let root = splitLeaf({ kind: 'leaf', paneId: 'a' }, 'a', 'row', 'b')
  root = splitLeaf(root, 'b', 'column', 'c')
  const { panes } = computeGeometry(root)
  check('a khong doi', near(panes.get('a').width, 50) && near(panes.get('a').height, 100))
  check('b nua tren cot phai', near(panes.get('b').left, 50) && near(panes.get('b').height, 50))
  check('c nua duoi cot phai', near(panes.get('c').top, 50) && near(panes.get('c').height, 50))
  check('thu tu trai->phai, tren->duoi', collectLeaves(root).join() === 'a,b,c')
  assertTiling('1 trai + 2 phai', root)
}

console.log('\n[6] resizeSplit + clamp')
{
  const root = splitLeaf({ kind: 'leaf', paneId: 'a' }, 'a', 'row', 'b')
  const split = root.id

  const moved = resizeSplit(root, split, 1, 20)
  const g1 = computeGeometry(moved)
  check('keo +20 -> 70/30', near(g1.panes.get('a').width, 70) && near(g1.panes.get('b').width, 30))

  const clamped = resizeSplit(root, split, 1, 999)
  const g2 = computeGeometry(clamped)
  check(
    `clamp toi da tai ${100 - MIN_SPLIT_PCT}%`,
    near(g2.panes.get('a').width, 100 - MIN_SPLIT_PCT)
  )

  const clampedLow = resizeSplit(root, split, 1, -999)
  const g3 = computeGeometry(clampedLow)
  check(`clamp toi thieu tai ${MIN_SPLIT_PCT}%`, near(g3.panes.get('a').width, MIN_SPLIT_PCT))
  assertTiling('sau khi keo', clamped)
}

console.log('\n[7] resize chi anh huong 2 nhanh ke divider')
{
  let root = splitLeaf({ kind: 'leaf', paneId: 'a' }, 'a', 'row', 'b')
  root = splitLeaf(root, 'b', 'row', 'c')
  const before = computeGeometry(root).panes.get('a').width
  const moved = resizeSplit(root, root.id, 2, 10)
  const after = computeGeometry(moved).panes
  check('a khong bi anh huong', near(after.get('a').width, before))
  check('b tang, c giam', near(after.get('b').width, 35) && near(after.get('c').width, 15))
  assertTiling('resize giua', moved)
}

console.log('\n[8] removeLeaf gop split con 1 nhanh')
{
  let root = splitLeaf({ kind: 'leaf', paneId: 'a' }, 'a', 'row', 'b')
  root = splitLeaf(root, 'b', 'column', 'c')

  const gone = removeLeaf(root, 'c')
  check('split doc bi gop, root con 2 con leaf', gone.kind === 'split' && gone.children.length === 2)
  check('con lai a,b', collectLeaves(gone).join() === 'a,b')
  assertTiling('sau khi xoa c', gone)

  const g2 = computeGeometry(gone).panes
  check('b lay lai full chieu cao', near(g2.get('b').height, 100))

  check('xoa het -> null', removeLeaf({ kind: 'leaf', paneId: 'a' }, 'a') === null)
  check('xoa id la -> cay khong doi', collectLeaves(removeLeaf(root, 'zzz')).join() === 'a,b,c')
}

console.log('\n[9] xoa lien tiep tu 8 pane ve 0')
{
  let root = { kind: 'leaf', paneId: 'p0' }
  for (let i = 1; i < 8; i += 1) {
    root = splitLeaf(root, `p${i - 1}`, i % 2 === 0 ? 'row' : 'column', `p${i}`)
  }
  assertTiling('8 pane', root)
  check('dung 8 leaf', leafCount(root) === 8)

  for (let i = 0; i < 8; i += 1) {
    root = removeLeaf(root, `p${i}`)
    if (root) assertTiling(`con ${7 - i} pane`, root)
  }
  check('cuoi cung ve null', root === null)
}

console.log('\n[10] split 8 lan lien tiep tren cung 1 pane')
{
  let root = { kind: 'leaf', paneId: 'p0' }
  for (let i = 1; i < 8; i += 1) {
    root = splitLeaf(root, 'p0', i % 2 === 0 ? 'row' : 'column', `p${i}`)
    assertTiling(`sau lan split ${i}`, root)
  }
  check('dung 8 leaf', leafCount(root) === 8)
  check('khong trung id', new Set(collectLeaves(root)).size === 8)
}

console.log('\n[11] cloneLayout doi paneId va split id')
{
  let root = splitLeaf({ kind: 'leaf', paneId: 'p1' }, 'p1', 'row', 'p2')
  root = splitLeaf(root, 'p2', 'column', 'p3')
  const clone = cloneLayout(root, (id) => `new-${id}`)
  check('paneId doi het', collectLeaves(clone).join() === 'new-p1,new-p2,new-p3')
  check('split id khac ban goc', clone.id !== root.id)
  check('goc khong bi sua', collectLeaves(root).join() === 'p1,p2,p3')
  const a = computeGeometry(root).panes.get('p3')
  const b = computeGeometry(clone).panes.get('new-p3')
  check('hinh hoc giu nguyen', near(a.left, b.left) && near(a.width, b.width))
}

console.log('\n[12] rowLayout + reconcile')
{
  check('rowLayout([]) = null', rowLayout([]) === null)
  check('rowLayout 1 phan tu = leaf', rowLayout(['a']).kind === 'leaf')
  const three = rowLayout(['a', 'b', 'c'])
  check('rowLayout 3 phan tu chia deu', computeGeometry(three).panes.get('b').width === 100 / 3)
  assertTiling('rowLayout 3', three)

  const fixed = reconcile(three, ['a', 'c', 'd'])
  check('bo leaf mo coi, them leaf thieu', collectLeaves(fixed).sort().join() === 'a,c,d')
  assertTiling('sau reconcile', fixed)
  check('reconcile(null, [x]) tao leaf', reconcile(null, ['x']).kind === 'leaf')
  check('reconcile(cay, []) = null', reconcile(three, []) === null)
}

console.log(failed === 0 ? '\nRESULT: tat ca pass' : `\nRESULT: ${failed} check FAIL`)
process.exit(failed === 0 ? 0 : 1)
