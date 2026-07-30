export const SINGULARITY_IDS = Object.freeze({
  ORDINARY_FOLD_POINT: "ordinary-fold-point",
  CUSP_ON_FOLD_CURVE: "cusp-on-fold-curve",
  ISOLATED_BRANCH_POINT: "isolated-branch-point",
});

export const FOLD_CURVE_LOCUS = Object.freeze({
  id: "sigma-fold-curve",
  symbol: "Σ",
  label: "one-dimensional fold curve",
  domain: "T²",
  dimension: 1,
  isolated: false,
  activeInTwoBandGame: true,
});

export const SINGULARITY_CATALOG = Object.freeze({
  [SINGULARITY_IDS.ORDINARY_FOLD_POINT]: Object.freeze({
    id: SINGULARITY_IDS.ORDINARY_FOLD_POINT,
    label: "ordinary point of the fold curve",
    singularLocusId: FOLD_CURVE_LOCUS.id,
    singularLocusDimension: 1,
    pointStratumDimension: 1,
    isolatedWithinSingularLocus: false,
    isolatedWithinCuspStratum: false,
    isolatedSingularLocus: false,
    localModel: "(u,v)↦(u,v²)",
    activeInTwoBandGame: true,
  }),
  [SINGULARITY_IDS.CUSP_ON_FOLD_CURVE]: Object.freeze({
    id: SINGULARITY_IDS.CUSP_ON_FOLD_CURVE,
    label: "cusp point on the fold curve",
    singularLocusId: FOLD_CURVE_LOCUS.id,
    singularLocusDimension: 1,
    pointStratumDimension: 0,
    isolatedWithinSingularLocus: false,
    isolatedWithinCuspStratum: true,
    isolatedSingularLocus: false,
    localModel: "(u,v)↦(u,v³+uv)",
    activeInTwoBandGame: true,
  }),
  [SINGULARITY_IDS.ISOLATED_BRANCH_POINT]: Object.freeze({
    id: SINGULARITY_IDS.ISOLATED_BRANCH_POINT,
    label: "isolated branch point",
    singularLocusId: "isolated-branch-locus",
    singularLocusDimension: 0,
    pointStratumDimension: 0,
    isolatedWithinSingularLocus: true,
    isolatedWithinCuspStratum: false,
    isolatedSingularLocus: true,
    localModel: "z↦z²",
    example: "Weierstrass ℘:T²→S² (four ramification points)",
    activeInTwoBandGame: false,
  }),
});

export function singularityEntity(id) {
  const entity = SINGULARITY_CATALOG[id];
  if (!entity) throw new RangeError(`Unknown singularity entity: ${id}`);
  return entity;
}

export function ordinaryFoldCrossing(context = "ordinary-fold") {
  return Object.freeze({
    locus: FOLD_CURVE_LOCUS,
    point: singularityEntity(SINGULARITY_IDS.ORDINARY_FOLD_POINT),
    encounter: "transverse-fold-crossing",
    context,
    cuspPointHit: false,
  });
}
