import { NextResponse } from 'next/server';

export const dynamic = 'force-static';
export const revalidate = 86400; // 24 hours

export async function GET() {
  const assetlinks = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.atomicpathshala.app',
        sha256_cert_fingerprint_list: [
          '14:6D:E9:75:A5:48:68:84:89:D2:DA:DE:6A:66:04:F7:62:3C:99:99:91:0A:79:B1:BD:3C:D0:BE:F4:65:21:40',
          'REPLACE_WITH_YOUR_PRODUCTION_RELEASE_KEYSTORE_SHA256_FINGERPRINT',
          'REPLACE_WITH_YOUR_PLAY_STORE_APP_SIGNING_KEY_SHA256_FINGERPRINT',
        ],
      },
    },
  ];

  return NextResponse.json(assetlinks, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
