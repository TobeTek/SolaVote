/// Verify a Merkle proof.
/// `leaf` must be the bytes of the voter pubkey (32 bytes).
/// `proof` is a vector of hashes (32 bytes each) showing the path from leaf to root.
/// Returns true if the computed root matches the given root.
pub fn verify_merkle_proof(
    leaf: &[u8; 32],
    root: &[u8; 32],
    proof: &Vec<[u8; 32]>,
) -> bool {
    use sha2::{Digest, Sha256};
    let mut computed_hash = *leaf;

    for proof_element in proof.iter() {
        let mut hasher = Sha256::new();

        if computed_hash <= *proof_element {
            hasher.update(computed_hash);
            hasher.update(proof_element);
        } else {
            hasher.update(proof_element);
            hasher.update(computed_hash);
        }

        computed_hash = hasher.finalize().as_slice().try_into().unwrap();
    }

    computed_hash == *root
}

#[cfg(test)]
mod tests {
    use super::*;
    use sha2::{Digest, Sha256};

    // Utility: compute hash of input bytes
    fn hash(data: &[u8]) -> [u8; 32] {
        let mut hasher = Sha256::new();
        hasher.update(data);
        hasher.finalize().as_slice().try_into().unwrap()
    }

    // Manually build a small Merkle tree and return leaf, root, and proof
    fn build_merkle_tree() -> ([u8; 32], [u8; 32], Vec<[u8; 32]>) {
        let leaf1 = hash(b"leaf one");
        let leaf2 = hash(b"leaf two");
        let leaf3 = hash(b"leaf three");
        let leaf4 = hash(b"leaf four");

        // Level 1 hashes
        let hash12 = if leaf1 <= leaf2 {
            hash(&[leaf1, leaf2].concat())
        } else {
            hash(&[leaf2, leaf1].concat())
        };
        let hash34 = if leaf3 <= leaf4 {
            hash(&[leaf3, leaf4].concat())
        } else {
            hash(&[leaf4, leaf3].concat())
        };

        // Root hash
        let root = if hash12 <= hash34 {
            hash(&[hash12, hash34].concat())
        } else {
            hash(&[hash34, hash12].concat())
        };

        // Proof for leaf1 is [leaf2, hash34]
        let proof = vec![leaf2, hash34];

        (leaf1, root, proof)
    }

    #[test]
    fn test_valid_merkle_proof() {
        let (leaf, root, proof) = build_merkle_tree();
        assert!(verify_merkle_proof(&leaf, &root, &proof));
    }

    #[test]
    fn test_invalid_merkle_proof() {
        let (leaf, root, mut proof) = build_merkle_tree();

        // Modify proof element to invalidate it
        proof[0][0] ^= 0xFF;

        assert!(!verify_merkle_proof(&leaf, &root, &proof));
    }

    #[test]
    fn test_empty_proof() {
        let leaf = hash(b"lonely leaf");
        let root = leaf;

        let proof: Vec<[u8; 32]> = vec![];
        assert!(verify_merkle_proof(&leaf, &root, &proof));
    }

    #[test]
    fn test_single_proof_element() {
        // Build a two-leaf tree; proof only has one element
        let leaf1 = hash(b"l1");
        let leaf2 = hash(b"l2");

        let root = if leaf1 <= leaf2 {
            hash(&[leaf1, leaf2].concat())
        } else {
            hash(&[leaf2, leaf1].concat())
        };

        let proof = vec![leaf2];

        assert!(verify_merkle_proof(&leaf1, &root, &proof));
        assert!(!verify_merkle_proof(&leaf2, &root, &proof));
    }
}