import ts from 'typescript';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = ts.transpileModule(
  fs.readFileSync('src/lib/muscle-activity.ts', 'utf8')
    .replace(/import type .*?;\n/g, ''),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
).outputText;

const { buildMuscleState, draftMuscleEntries, resolveMuscleKeys } = await import(
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
);

assert.deepEqual(resolveMuscleKeys('Peito'), ['chest']);
assert.deepEqual(resolveMuscleKeys('Trapézio'), ['traps']);
assert.deepEqual(resolveMuscleKeys('Core'), ['abs', 'obliques']);
const state = buildMuscleState([
  { muscle: 'Costas', role: 'primary' },
  { muscle: 'Trapézio', role: 'secondary' },
  { muscle: 'Bíceps', role: 'tertiary' },
]);
assert.equal(state.lats.role, 'primary');
assert.equal(state.traps.role, 'secondary');
assert.equal(state.biceps.role, 'tertiary');
assert.equal(state.lats.level, 1);

const draftEntries = draftMuscleEntries({
  id: 'session-1', userId: 'u1', workoutId: 'w1', name: 'Costas', started: Date.now(), restUntil: 0,
  exercises: [{
    exercise_id: 'e1', nome: 'Remada', musculo_principal: 'Costas',
    musculos_secundarios: ['Bíceps'], musculos_terciarios: ['Trapézio'], descanso_seg: 60,
    sets: [
      { id: 's1', reps: '10', carga: '20', done: true, kind: 'normal' },
      { id: 's2', reps: '10', carga: '20', done: false, kind: 'normal' },
      { id: 's3', reps: '10', carga: '20', done: true, kind: 'warmup' },
    ],
  }],
});
assert.deepEqual(draftEntries, [
  { muscle: 'Costas', role: 'primary' },
  { muscle: 'Bíceps', role: 'secondary' },
  { muscle: 'Trapézio', role: 'tertiary' },
]);
console.log('PASS: Portuguese muscle labels map to the anatomical heatmap with role hierarchy.');
