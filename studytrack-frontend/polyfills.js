import 'react-native-get-random-values';
import * as ExpoCrypto from 'expo-crypto';

// Polyfill crypto.subtle.digest for Supabase PKCE SHA-256 on Hermes.
// react-native-get-random-values patches getRandomValues but not subtle.digest,
// which Supabase needs to compute the PKCE code challenge.
if (!global.crypto.subtle) {
  global.crypto.subtle = {
    digest: async (_algorithm, data) => {
      // data is a Uint8Array of the code verifier's UTF-8 bytes (ASCII-safe).
      const str = Array.from(new Uint8Array(data))
        .map((b) => String.fromCharCode(b))
        .join('');
      const base64 = await ExpoCrypto.digestStringAsync(
        ExpoCrypto.CryptoDigestAlgorithm.SHA256,
        str,
        { encoding: ExpoCrypto.CryptoEncoding.BASE64 }
      );
      const binary = atob(base64);
      const buf = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
      return buf.buffer;
    },
  };
}
