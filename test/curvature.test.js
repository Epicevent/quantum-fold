import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import {
  berryDensityXY,
  cp1ChernCharge,
  cp1DiskIntegral,
  cp1Scale,
  foldRegularizationSample,
  fsMetricCoefficient,
  localFoldMetric,
  paperCurvatureBridge,
  regularizedFoldInverse,
  ricciDensityXY,
  TWO_PI,
} from "../src/curvature-math.js";
import {
  answerCurvatureQuestion,
  createCurvatureState,
  currentCurvatureQuestion,
  CURVATURE_MISSIONS,
  CURVATURE_QUESTIONS,
  perfectCurvatureChoices,
  replayCurvatureRun,
  startCurvatureRun,
} from "../src/curvature-mechanics.js";

test("the CP1 patch fixes the metric, Berry, and Ricci factor at z=1", () => {
  assert.equal(cp1Scale(1, 0), 2);
  assert.equal(fsMetricCoefficient(1, 0), 1 / 4);
  assert.equal(berryDensityXY(1, 0), 1 / 2);
  assert.equal(ricciDensityXY(1, 0), 1);
  assert.equal(ricciDensityXY(0.37, -0.42), 2 * berryDensityXY(0.37, -0.42));
});

test("the CP1 radial integrals converge independently to Chern numbers one and two", () => {
  const berryLargeDisk = cp1DiskIntegral(10_000, "berry");
  const ricciLargeDisk = cp1DiskIntegral(10_000, "ricci");
  assert.ok(Math.abs(berryLargeDisk - TWO_PI) < 1e-7);
  assert.ok(Math.abs(ricciLargeDisk - 2 * TWO_PI) < 2e-7);
  assert.equal(cp1ChernCharge("berry"), 1);
  assert.equal(cp1ChernCharge("ricci"), 2);
});

test("the paper bridge pulls Ricci back to twice Berry and signed Gauss density", () => {
  const sample = paperCurvatureBridge(Math.PI, 0);
  assert.equal(sample.berry, 1 / 2);
  assert.equal(sample.pulledBackRicci, 1);
  assert.equal(sample.signedGauss, 1);

  for (const [kx, ky] of [[0.2, -0.4], [2.1, 1.4], [Math.PI, Math.PI]]) {
    const bridge = paperCurvatureBridge(kx, ky);
    assert.equal(bridge.pulledBackRicci, 2 * bridge.berry);
    assert.equal(bridge.signedGauss, bridge.pulledBackRicci);
  }
});

test("the local fold separates unsigned metric area from differentiable signed area", () => {
  assert.deepEqual(localFoldMetric(-0.4), {
    g11: 1,
    g12: 0,
    g22: 0.16000000000000003,
    determinant: 0.16000000000000003,
    unsignedDensity: 0.4,
    signedDensity: -0.4,
  });
  assert.equal(localFoldMetric(0).determinant, 0);
  assert.equal(localFoldMetric(0.4).signedDensity, 0.4);
});

test("regularization gives an inverse for epsilon positive but diverges at the fold", () => {
  const coarse = regularizedFoldInverse(0, 1e-1);
  const fine = regularizedFoldInverse(0, 1e-6);
  assert.equal(coarse.inverse22, 10);
  assert.equal(fine.inverse22, 1_000_000);
  assert.ok(fine.regularizedAreaDensity < coarse.regularizedAreaDensity);
  assert.throws(() => regularizedFoldInverse(0, 0), /epsilon must be positive/);

  const negative = foldRegularizationSample(-0.2, 1e-3);
  const positive = foldRegularizationSample(0.2, 1e-3);
  assert.equal(negative.regularizedAreaDensity, positive.regularizedAreaDensity);
  assert.equal(negative.signedDensity, -positive.signedDensity);
});

test("wrong shots cannot advance the calculation and preserve the expected answer", () => {
  const active = startCurvatureRun(createCurvatureState());
  const question = currentCurvatureQuestion(active);
  const wrong = (question.correct + 1) % question.choices.length;
  const result = answerCurvatureQuestion(active, wrong);
  assert.equal(result.missionIndex, 0);
  assert.equal(result.questionIndex, 0);
  assert.equal(result.correctAnswers, 0);
  assert.equal(result.wrongAnswers, 1);
  assert.equal(result.lastEvent.expected, question.correct);
});

test("the authored perfect run reaches the decisive receipt", () => {
  const state = replayCurvatureRun(perfectCurvatureChoices());
  assert.equal(state.status, "complete");
  assert.equal(state.correctAnswers, CURVATURE_QUESTIONS.length);
  assert.equal(state.wrongAnswers, 0);
  assert.equal(state.receipt.length, CURVATURE_QUESTIONS.length);
  assert.equal(state.berryCharge, 1);
  assert.equal(state.ricciCharge, 2);
  assert.equal(state.receipt.at(-1).after, "SIGNED FORM SURVIVES · INVERSE METRIC DOES NOT");
});

test("curvature replay is deterministic across a mixed answer stream", () => {
  const perfect = perfectCurvatureChoices();
  const stream = [];
  for (let index = 0; index < perfect.length; index += 1) {
    if (index % 5 === 2) stream.push((perfect[index] + 1) % CURVATURE_QUESTIONS[index].choices.length);
    stream.push(perfect[index]);
  }
  assert.deepEqual(replayCurvatureRun(stream), replayCurvatureRun(stream));
});

test("each mission raises one new obstruction while retaining a decisive final expression", () => {
  assert.deepEqual(CURVATURE_MISSIONS.map((mission) => mission.id), [
    "patch",
    "curvatures",
    "chern",
    "pullback",
    "fold",
  ]);
  for (const mission of CURVATURE_MISSIONS) {
    assert.ok(mission.questions.length >= 4);
    assert.ok(mission.questions.every((question) => question.after && question.reason));
  }
});

test("the browser contract exposes an immediate shot, the two bundles, the fold probe, and the final verdict", async () => {
  const html = await fs.readFile(new URL("../curvature.html", import.meta.url), "utf8");
  for (const required of [
    "START · SHOOT S=2",
    "EIGENLINE CONNECTION",
    "HOLOMORPHIC TANGENT BUNDLE",
    "LIVE REGULARIZATION PROBE",
    "Fold는 원인이 아니라",
    "f*ρ=2F<sub>B</sub>=K<sub>G</sub>dĀ",
  ]) {
    assert.ok(html.includes(required), `missing browser contract: ${required}`);
  }
});
