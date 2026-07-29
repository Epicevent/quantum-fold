# Quantum Fold - game principles

Build a game from these principles, not a visualization with a score pasted on it.

1. The player acts in a periodic two-dimensional domain while seeing those actions trace a state surface. Crossing one edge must return through the opposite edge, so periodicity is learned through motion before it is named.
2. The domain-to-surface map is the core mechanic. A visible surface point may have one source or three distinct sources. The player must sometimes reason about provenance, not merely about where an object appears.
3. A closed fold curve divides regions of opposite orientation. Crossing it is not an arbitrary wall or instant failure: it reverses the sign of the player's contribution and changes how motion maps onto the state surface.
4. Raw coverage is a tempting but misleading quantity. Progress is measured by signed coverage: oppositely oriented layers cancel. A successful run produces a stable integer charge even when the apparent surface has been swept multiple times.
5. Cusps are high-risk, high-information locations where a fold turns sharply. They must be strongly telegraphed. Their challenge should arise from compressed geometry and rapid orientation change, not surprise damage.
6. Local geometry and global topology play different roles. Local stretch, compression, and curvature determine moment-to-moment handling; the global integer is the mission objective. The player should learn that locally messy motion can still assemble a robust global result.
7. Cosmetic phase, camera rotation, or representation changes must never change the answer. Only the physical path and its oriented image matter.
8. Every failure and completion should expose evidence: the domain path, mapped path, current orientation, layer multiplicity, raw area, signed area, and resulting integer. Feedback should let the player discover why two visually similar runs differ.
9. Teach by staged play, not an exposition dump: periodic movement, then fold crossing, then multiple sources, then signed cancellation, then a free mission targeting an integer charge. The first meaningful action should take seconds; a complete conceptual loop should fit in a short session.
10. Preserve legibility under motion. The player must always distinguish their controllable source, its mapped image, fold boundaries, cusp warnings, orientation sign, and the immediate objective without reading equations.
11. Make the controls responsive and the audiovisual feedback expressive. Scientific fidelity constrains the relationships above, but the moment-to-moment play must stand on its own as a game.
12. Keep simulation state deterministic and separable from rendering so mechanics can be tested. Test at least periodic wraparound, orientation reversal, one-to-three mapping, signed cancellation, and integer completion.

The implementation is otherwise yours. Choose the genre, visual language, level structure, and exact controls that make these relationships easiest and most satisfying to learn through play.
