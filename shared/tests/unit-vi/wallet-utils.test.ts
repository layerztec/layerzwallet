import assert from 'assert';
import { describe, expect, it, test } from 'vitest';

import { sanitizeAndValidateMnemonic, validateAddress } from '../../modules/wallet-utils';
import {
  NETWORK_ALPEN_TESTNET,
  NETWORK_ARK,
  NETWORK_ARK_MUTINYNET,
  NETWORK_BITCOIN,
  NETWORK_CITREA_TESTNET,
  NETWORK_LIQUID,
  NETWORK_ROOTSTOCK,
  NETWORK_SEPOLIA,
  NETWORK_SPARK,
  NETWORK_STACKS,
} from '../../types/networks';

describe('wallet-utils', () => {
  describe('sanitizeAndValidateMnemonic', () => {
    test('should handle complex whitespace scenarios', () => {
      const mnemonic = '\n\n  abandon\t abandon   abandon\r\n abandon abandon  abandon\t\t abandon abandon abandon abandon   abandon ABOUT  \n\n';
      const result = sanitizeAndValidateMnemonic(mnemonic);
      assert.strictEqual(result, 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
    });

    test('should handle double calls', () => {
      const mnemonic = '\n\n  abandon\t abandon   abandon\r\n abandon abandon  abandon\t\t abandon abandon abandon abandon   abandon ABOUT  \n\n';
      const result = sanitizeAndValidateMnemonic(sanitizeAndValidateMnemonic(mnemonic));
      assert.strictEqual(result, 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
    });

    test('should throw error for mnemonic with less than 12 words', () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon';
      assert.throws(() => {
        sanitizeAndValidateMnemonic(mnemonic);
      }, /Invalid mnemonic length/);
    });
  });

  describe('validateAddress', () => {
    describe('Bitcoin addresses', () => {
      it('should validate valid Bitcoin legacy addresses', () => {
        expect(validateAddress(NETWORK_BITCOIN, '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).toBe(true);
        expect(validateAddress(NETWORK_BITCOIN, '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy')).toBe(true);
      });

      it('should validate valid Bitcoin bech32 addresses', () => {
        expect(validateAddress(NETWORK_BITCOIN, 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe(true);
        expect(validateAddress(NETWORK_BITCOIN, 'bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3')).toBe(true);
      });

      it('should validate valid Bitcoin taproot addresses', () => {
        expect(validateAddress(NETWORK_BITCOIN, 'bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297')).toBe(true);
      });

      it('should reject invalid Bitcoin addresses', () => {
        expect(validateAddress(NETWORK_BITCOIN, '')).toBe(false);
        expect(validateAddress(NETWORK_BITCOIN, 'invalid')).toBe(false);
        expect(validateAddress(NETWORK_BITCOIN, '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN')).toBe(false); // invalid checksum
        expect(validateAddress(NETWORK_BITCOIN, 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t')).toBe(false); // invalid length
      });
    });

    describe('Liquid addresses', () => {
      it('should validate valid Liquid addresses', () => {
        expect(validateAddress(NETWORK_LIQUID, 'lq1qq0pprchwrjrc7arz2nkh3ty0arasl38h7pj8xsa3ljlzne2mcpvfz5s5kpqvgg3pmjqg7gsd79e37lxfym8tk06l0pv279xn3')).toBe(true);
        expect(validateAddress(NETWORK_LIQUID, 'VJ7fHq1xN8jQk5rD9mT2Wc4aS6uPbEyZh3RKoC1UdLv')).toBe(true);
      });

      it('should reject invalid Liquid addresses', () => {
        expect(validateAddress(NETWORK_LIQUID, '')).toBe(false);
        expect(validateAddress(NETWORK_LIQUID, 'invalid')).toBe(false);
        expect(validateAddress(NETWORK_LIQUID, 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe(false); // Bitcoin address
      });
    });

    describe('Spark addresses', () => {
      it('should validate valid Spark addresses', () => {
        expect(validateAddress(NETWORK_SPARK, 'spark1pgssx2srkm6344nxzngx9n8stj5uxp544dgm3mrdgpeulr8phutzdx89vlg5kf')).toBe(true);
      });

      it('should reject invalid Spark addresses', () => {
        expect(validateAddress(NETWORK_SPARK, '')).toBe(false);
        expect(validateAddress(NETWORK_SPARK, 'invalid')).toBe(false);
        expect(validateAddress(NETWORK_SPARK, 'spark1invalid')).toBe(false);
        expect(validateAddress(NETWORK_SPARK, 'spark1')).toBe(false);
        expect(validateAddress(NETWORK_SPARK, 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe(false); // Bitcoin address
      });
    });

    describe('ARK addresses', () => {
      it('should validate valid ARK addresses', () => {
        // Valid ARK addresses (bech32m encoded)
        expect(validateAddress(NETWORK_ARK, 'ark1qqellv77udfmr20tun8dvju5vgudpf9vxe8jwhthrkn26fz96pawqfdy8nk05rsmrf8h94j26905e7n6sng8y059z8ykn2j5xcuw4xt8ngt9rw')).toBe(true);
        expect(validateAddress(NETWORK_ARK_MUTINYNET, 'ark1qqellv77udfmr20tun8dvju5vgudpf9vxe8jwhthrkn26fz96pawqfdy8nk05rsmrf8h94j26905e7n6sng8y059z8ykn2j5xcuw4xt8ngt9rw')).toBe(true);
      });

      it('should reject invalid ARK addresses', () => {
        expect(validateAddress(NETWORK_ARK, '')).toBe(false);
        expect(validateAddress(NETWORK_ARK, 'invalid')).toBe(false);
        expect(validateAddress(NETWORK_ARK, '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).toBe(false); // Bitcoin address
        expect(validateAddress(NETWORK_ARK, 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe(false); // Bitcoin address
        expect(validateAddress(NETWORK_ARK_MUTINYNET, 'spark1pgssx2srkm6344nxzngx9n8stj5uxp544dgm3mrdgpeulr8phutzdx89vlg5kf')).toBe(false); // Spark address
        expect(validateAddress(NETWORK_ARK, 'ark1invalid')).toBe(false); // Invalid ARK address format
      });
    });

    describe('Stacks addresses', () => {
      it('should validate valid Stacks addresses', () => {
        expect(validateAddress(NETWORK_STACKS, 'SP2R874DNSDKVF0Z281M8H9A2CCNZ3HDH4W2DZNT6')).toBe(true);
        expect(validateAddress(NETWORK_STACKS, 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG')).toBe(true);
      });

      it('should reject invalid Stacks addresses', () => {
        expect(validateAddress(NETWORK_STACKS, '')).toBe(false);
        expect(validateAddress(NETWORK_STACKS, 'invalid')).toBe(false);
        expect(validateAddress(NETWORK_STACKS, 'SP2R874DNSDKVF0Z281M8H9A2CCNZ3HDH4W2DZNT')).toBe(false); // too short
        expect(validateAddress(NETWORK_STACKS, 'XP2R874DNSDKVF0Z281M8H9A2CCNZ3HDH4W2DZNT6')).toBe(false); // wrong prefix
        expect(validateAddress(NETWORK_STACKS, 'SP2R874DNSDKVF0Z281M8H9A2CCNZ3HDH4W2DZNT6X')).toBe(false); // too long
      });
    });

    describe('EVM addresses', () => {
      it('should validate valid EVM addresses', () => {
        const validAddress = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';
        expect(validateAddress(NETWORK_SEPOLIA, validAddress)).toBe(true);
        expect(validateAddress(NETWORK_ALPEN_TESTNET, validAddress)).toBe(true);
        expect(validateAddress(NETWORK_CITREA_TESTNET, validAddress)).toBe(true);
      });

      it('should reject invalid EVM addresses', () => {
        expect(validateAddress(NETWORK_ROOTSTOCK, '')).toBe(false);
        expect(validateAddress(NETWORK_ROOTSTOCK, 'invalid')).toBe(false);
        expect(validateAddress(NETWORK_ROOTSTOCK, '0x9858EfFD232B4033E47d90003D41EC34EcaEda9')).toBe(false); // too short
        expect(validateAddress(NETWORK_ROOTSTOCK, '0x9858EfFD232B4033E47d90003D41EC34EcaEda94G')).toBe(false); // invalid character
        expect(validateAddress(NETWORK_ROOTSTOCK, '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).toBe(false); // Bitcoin address
      });
    });

    describe('Error handling', () => {
      it('should handle exceptions gracefully', () => {
        // Test with null/undefined inputs
        expect(validateAddress(NETWORK_BITCOIN, null as any)).toBe(false);
        expect(validateAddress(NETWORK_BITCOIN, undefined as any)).toBe(false);
        expect(validateAddress(null as any, '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).toBe(false);
      });
    });
  });
});
