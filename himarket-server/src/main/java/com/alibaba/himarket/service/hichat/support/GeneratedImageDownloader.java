/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
package com.alibaba.himarket.service.hichat.support;

import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;
import org.springframework.stereotype.Component;

@Component
public class GeneratedImageDownloader {

    private static final int MAX_IMAGE_SIZE = 16 * 1024 * 1024 - 1;
    private static final int MAX_REDIRECTS = 3;
    private static final Set<Integer> REDIRECT_STATUS_CODES = Set.of(301, 302, 303, 307, 308);

    /**
     * Downloads a generated image after validating its target address, size, and format.
     *
     * @param imageUrl provider image URL
     * @return validated image data
     */
    public DownloadedImage download(String imageUrl) {
        URI uri;
        try {
            uri = URI.create(imageUrl);
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("Image generation returned an invalid image URL", e);
        }

        for (int redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
            URI requestUri = uri;
            List<InetAddress> addresses = resolvePublicAddresses(requestUri);
            OkHttpClient client =
                    new OkHttpClient.Builder()
                            .connectTimeout(10, TimeUnit.SECONDS)
                            .readTimeout(60, TimeUnit.SECONDS)
                            .callTimeout(60, TimeUnit.SECONDS)
                            .followRedirects(false)
                            .followSslRedirects(false)
                            .dns(
                                    hostname ->
                                            hostname.equalsIgnoreCase(requestUri.getHost())
                                                    ? addresses
                                                    : List.of())
                            .build();

            Request request = new Request.Builder().url(requestUri.toString()).get().build();
            try (Response response = client.newCall(request).execute()) {
                if (REDIRECT_STATUS_CODES.contains(response.code())) {
                    String location = response.header("Location");
                    if (location == null || redirectCount == MAX_REDIRECTS) {
                        throw new IllegalStateException(
                                "Image download exceeded the redirect limit");
                    }
                    uri = requestUri.resolve(location);
                    continue;
                }
                if (!response.isSuccessful() || response.body() == null) {
                    throw new IllegalStateException(
                            "Failed to download generated image, status=" + response.code());
                }
                return readImage(response.body());
            } catch (IOException e) {
                throw new IllegalStateException("Failed to download generated image", e);
            }
        }

        throw new IllegalStateException("Image download exceeded the redirect limit");
    }

    private DownloadedImage readImage(ResponseBody body) throws IOException {
        if (body.contentLength() > MAX_IMAGE_SIZE) {
            throw new IllegalStateException("Generated image exceeds the storage limit");
        }

        byte[] data;
        try (InputStream input = body.byteStream()) {
            data = input.readNBytes(MAX_IMAGE_SIZE + 1);
        }
        if (data.length == 0) {
            throw new IllegalStateException("Generated image is empty");
        }
        if (data.length > MAX_IMAGE_SIZE) {
            throw new IllegalStateException("Generated image exceeds the storage limit");
        }
        return new DownloadedImage(detectMediaType(data), data);
    }

    private List<InetAddress> resolvePublicAddresses(URI uri) {
        String scheme = uri.getScheme();
        String host = uri.getHost();
        if (host == null
                || (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme))) {
            throw new IllegalStateException("Generated image URL must use HTTP or HTTPS");
        }

        List<InetAddress> addresses;
        try {
            addresses = Arrays.asList(InetAddress.getAllByName(host));
        } catch (UnknownHostException e) {
            throw new IllegalStateException("Failed to resolve generated image host", e);
        }
        if (addresses.isEmpty() || addresses.stream().anyMatch(this::isPrivateAddress)) {
            throw new IllegalStateException("Generated image URL points to a private address");
        }
        return addresses;
    }

    private boolean isPrivateAddress(InetAddress address) {
        if (address.isAnyLocalAddress()
                || address.isLoopbackAddress()
                || address.isLinkLocalAddress()
                || address.isSiteLocalAddress()
                || address.isMulticastAddress()) {
            return true;
        }

        byte[] bytes = address.getAddress();
        if (bytes.length == 4) {
            int first = Byte.toUnsignedInt(bytes[0]);
            int second = Byte.toUnsignedInt(bytes[1]);
            return first == 100 && second >= 64 && second <= 127;
        }
        return bytes.length == 16 && (bytes[0] & 0xfe) == 0xfc;
    }

    private String detectMediaType(byte[] data) {
        if (data.length >= 8
                && data[0] == (byte) 0x89
                && data[1] == 0x50
                && data[2] == 0x4e
                && data[3] == 0x47
                && data[4] == 0x0d
                && data[5] == 0x0a
                && data[6] == 0x1a
                && data[7] == 0x0a) {
            return "image/png";
        }
        if (data.length >= 3
                && data[0] == (byte) 0xff
                && data[1] == (byte) 0xd8
                && data[2] == (byte) 0xff) {
            return "image/jpeg";
        }
        if (data.length >= 12
                && data[0] == 'R'
                && data[1] == 'I'
                && data[2] == 'F'
                && data[3] == 'F'
                && data[8] == 'W'
                && data[9] == 'E'
                && data[10] == 'B'
                && data[11] == 'P') {
            return "image/webp";
        }
        throw new IllegalStateException("Generated image format is not supported");
    }

    /**
     * Validated generated image.
     *
     * @param mimeType detected MIME type
     * @param data image bytes
     */
    public record DownloadedImage(String mimeType, byte[] data) {}
}
