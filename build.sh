#!/bin/bash
# OpenSway ZXP Build Script

# Configuration
EXTENSION_NAME="OpenSway"
VERSION="1.0.0"
OUTPUT_DIR="./dist"
ZXP_NAME="${EXTENSION_NAME}_${VERSION}.zxp"

# Check if ZXPSignCmd exists
if ! command -v ZXPSignCmd &> /dev/null; then
    echo "ZXPSignCmd not found."
    echo ""
    echo "Download from: https://github.com/AdobeDocs/cc-extension-builder-guide/releases"
    echo ""
    echo "Or install via npm: npm install -g zxp-sign-cmd"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Create self-signed certificate if not exists
CERT_FILE="./dist/certificate.p12"
CERT_PASSWORD="OpenSway2024"

if [ ! -f "$CERT_FILE" ]; then
    echo "Creating self-signed certificate..."
    ZXPSignCmd -selfSignedCert JP Tokyo OpenSway OpenSway "$CERT_PASSWORD" "$CERT_FILE"
fi

# Build ZXP
echo "Building ZXP..."
ZXPSignCmd -sign . "${OUTPUT_DIR}/${ZXP_NAME}" "$CERT_FILE" "$CERT_PASSWORD" -tsa http://timestamp.digicert.com

if [ $? -eq 0 ]; then
    echo ""
    echo "Build successful: ${OUTPUT_DIR}/${ZXP_NAME}"
    echo ""
    echo "Install with:"
    echo "  - Anastasiy's Extension Manager: https://install.anastasiy.com/"
    echo "  - ExManCmd: ExManCmd --install ${OUTPUT_DIR}/${ZXP_NAME}"
    echo "  - ZXP Installer: https://aescripts.com/zxp-installer/"
else
    echo "Build failed"
    exit 1
fi
