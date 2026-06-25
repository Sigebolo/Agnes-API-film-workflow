🎨 Visual Identity & Styling
Cosmic Obsidian Theme: Features a high-contrast dark aesthetic with deep grays (#09090A to #1A1A1D) paired with vivid warm amber, orange, and gold accents (from-orange-600 to-red-600) designed for creative professionals.
Micro-animations & Spacing: Implements subtle transition animations, pulsating indicators for active synthesis states, and generous negative space to minimize visual clutter.
🏗️ Full-Stack System Architecture
Secured Express Proxy: Bridges client-side React requests with the Agnes AI platform securely. By processing authentication headers server-side, it keeps API keys hidden from client-side network inspectors.
Intelligent Neural Simulators: Seamlessly falls back to simulated networks and mock models when API credentials are omitted, allowing developers to safely run, debug, and prototype layouts locally.
🚀 Core Functional Modules
Prompt Optimization Editor: Enhances simple descriptions into high-fidelity cinematic prompts with style selection nodes (e.g., Sci-Fi, Gothic, Cyberpunk).
Text-to-Image & Image-to-Image (图生图):
Supports using the Current Scene Image or a custom URL as a reference asset.
Controls prompt weight guidance via an interactive Strength slider (0.1 for maximum layout retention, 0.9 for maximum creative divergence).
Keeps users informed with Live Terminal Logging Panels, customized full-screen error alerts, aborted pipeline statuses, and one-click retries.
Video Motion Synthesis: Interpolates keyframe sequences into fluid animations, utilizing a robust exponential backoff polling mechanism.
Timeline & Cinematic Composition: Integrates synthetic voiceovers and subtitles into a cohesive playhead tracking preview.



I am free when below API is free:
Have fun。

# Agnes Image 2.1 Flash


## Model Overview


**Agnes Image 2.1 Flash** is an upgraded image generation model by Sapiens AI, supporting both **text-to-image** and **image-to-image** workflows.


Compared with previous versions, Agnes Image 2.1 Flash provides improved performance for **high-information-density images**, making it more suitable for scenarios that require complex visual details, richer composition, and clearer semantic alignment.


Agnes Image 2.1 Flash can be used to generate images from text prompts, transform existing images, preserve original composition during editing, and return results either as image URLs or Base64 data.


---


# Key Capabilities


| Capability                                  | Description                                                                               |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Text-to-Image                               | Generate high-quality images from natural language prompts                                |
| Image-to-Image                              | Transform or refine existing images based on prompt instructions                          |
| High-Information-Density Image Optimization | Improved handling of images with rich details, complex layouts, and dense visual elements |
| Composition Preservation                    | Preserve the original composition when editing or transforming input images               |
| Flexible Size Control                       | Supports custom output sizes such as 1024x768                                             |
| URL Response                                | Return generated image results as accessible image URLs                                   |
| Base64 Response                             | Return generated image results as Base64 data when required                               |
| URL or Data URI Input                       | Image-to-image supports public image URLs or Data URI Base64 input                        |


---


# Applicable Scenarios


Agnes Image 2.1 Flash is suitable for:


| Scenario                       | Example Use Cases                                            |
| ------------------------------ | ------------------------------------------------------------ |
| Creative Design                | Concept art, visual exploration, poster drafts               |
| Marketing Content              | Campaign images, product visuals, social media creatives     |
| High-Density Visual Generation | Detailed scenes, rich compositions, complex environments     |
| Image Transformation           | Style transfer, scene re-lighting, background transformation |
| Content Production             | App assets, thumbnails, banners, storytelling visuals        |
| Product Visualization          | Product photos, mockups, commercial visuals                  |
| Social Media Assets            | Covers, banners, thumbnails, post images                     |


---


# API Information


## Base URL


```plain text
https://apihub.agnes-ai.com
```


## Endpoint


| Item                  | Description                                       |
| --------------------- | ------------------------------------------------- |
| API Endpoint          | https://apihub.agnes-ai.com/v1/images/generations |
| Request Method        | POST                                              |
| Content-Type          | application/json                                  |
| Authentication        | Bearer Token                                      |
| Authentication Header | Authorization: Bearer YOUR_API_KEY                |


---


# Model


Use the following model name for both text-to-image and image-to-image workflows:


```plain text
agnes-image-2.1-flash
```


---


# Important Notes

- Use `agnes-image-2.1-flash` as the model name.
- For text-to-image generation, `model`, `prompt`, and `size` are required.
- For image-to-image generation, provide the input image URL or Data URI Base64 in the top-level `image` array.
- Do not put `response_format` at the top level of the request body.
- If you need URL output, put `"response_format": "url"` inside `extra_body`.
- If you need Base64 output for text-to-image, you can use the top-level parameter `"return_base64": true`.
- For image-to-image Base64 output, use `"response_format": "b64_json"` inside `extra_body`.
- You do not need to pass `tags: ["img2img"]` for image-to-image requests.
- Do not expose temporary API keys in public documentation. Use `YOUR_API_KEY` in all public examples.

---


# Request Parameters


| Parameter                  | Type     | Required                    | Description                                                      |
| -------------------------- | -------- | --------------------------- | ---------------------------------------------------------------- |
| model                      | string   | Yes                         | Model name. Use agnes-image-2.1-flash                            |
| prompt                     | string   | Yes                         | Text instruction for image generation or image editing           |
| size                       | string   | Yes                         | Output image size, such as 1024x768                              |
| image                      | string[] | Required for image-to-image | Input image array. Supports public image URLs or Data URI Base64 |
| return_base64              | boolean  | No                          | Used when text-to-image output should be returned as Base64      |
| extra_body                 | object   | No                          | Additional parameters for advanced workflows                     |
| extra_body.response_format | string   | No                          | Output format. Common values: url, b64_json                      |


---


# Call Examples


## 1. Text-to-Image Request with URL Output


Use this request to generate an image from a text prompt and return the result as an image URL.


```bash
curl https://apihub.agnes-ai.com/v1/images/generations \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "agnes-image-2.1-flash",
    "prompt": "A luminous floating city above a misty canyon at sunrise, cinematic realism",
    "size": "1024x768",
    "extra_body": {
      "response_format": "url"
    }
  }'
```


The generated image URL is returned in:


```plain text
data[0].url
```


---


## 2. Text-to-Image Request with Base64 Output


Use this request when you want the generated image returned as Base64 data.


```bash
curl https://apihub.agnes-ai.com/v1/images/generations \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "agnes-image-2.1-flash",
    "prompt": "A clean product photo of a glass cube on a white studio background, soft shadows, high detail",
    "size": "1024x768",
    "return_base64": true
  }'
```


The generated Base64 image is returned in:


```plain text
data[0].b64_json
```


---


## 3. Image-to-Image Request with URL Input and URL Output


Use this request to transform an existing image while preserving the original composition.


```bash
curl https://apihub.agnes-ai.com/v1/images/generations \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "agnes-image-2.1-flash",
    "prompt": "Transform the scene into a rain-soaked cyberpunk night with neon reflections while preserving the original composition",
    "size": "1024x768",
    "extra_body": {
	     "image": [
      "https://example.com/input-image.png"
    ],
      "response_format": "url"
    }
  }'
```


The generated image URL is returned in:


```plain text
data[0].url
```


---


## 4. Image-to-Image Request with URL Input and Base64 Output


Use this request when the input image is provided as a public URL and the generated result should be returned as Base64 data.


```bash
curl https://apihub.agnes-ai.com/v1/images/generations \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "agnes-image-2.1-flash",
    "prompt": "Make the object orange while preserving the original composition",
    "size": "1024x768",
    "extra_body": {
	    "image": [
      "https://example.com/input-image.png"
    ],
      "response_format": "b64_json"
    }
  }'
```


The generated Base64 image is returned in:


```plain text
data[0].b64_json
```


---


## 5. Image-to-Image Request with Data URI Base64 Input


Image-to-image also supports Data URI Base64 input.


Data URI format:


```plain text
data:image/png;base64,BASE64_HERE
```


Request example:


```bash
curl https://apihub.agnes-ai.com/v1/images/generations \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "agnes-image-2.1-flash",
    "prompt": "Make the object matte black while preserving the original composition",
    "size": "1024x768",
    "extra_body": {
	     "image": [
      "data:image/png;base64,BASE64_HERE"
    ],
      "response_format": "b64_json"
    }
  }'
```


---


# Response Format


## URL Output


When `extra_body.response_format` is set to `url`, the response format is:


```json
{
  "created": 1780000000,
  "data": [
    {
      "url": "https://storage.googleapis.com/agnes-aigc/xxx.png",
      "b64_json": null,
      "revised_prompt": null
    }
  ]
}
```


Generated image URL:


```plain text
data[0].url
```


---


## Base64 Output


When Base64 output is enabled, the response format is:


```json
{
  "created": 1780000000,
  "data": [
    {
      "url": null,
      "b64_json": "iVBORw0KGgoAAAANSUhEUgAA...",
      "revised_prompt": null
    }
  ]
}
```


Generated Base64 image:


```plain text
data[0].b64_json
```


---


# Recommended Prompt Structure


For better image generation results, use a clear prompt structure:


```plain text
[Subject] + [Scene / Environment] + [Style] + [Lighting] + [Composition] + [Quality Requirements]
```


## Example


```plain text
A luminous floating city above a misty canyon at sunrise, cinematic realism, wide-angle composition, rich architectural details, soft golden light, high visual density
```


For image-to-image tasks, clearly describe what should change and what should remain unchanged.


```plain text
Transform the scene into a rain-soaked cyberpunk night with neon reflections while preserving the original composition and main subject layout.
```


---


# Best Practices


## For Text-to-Image


Use detailed prompts when generating complex images. Include subject, environment, style, lighting, camera angle, and desired level of detail.


Good example:


```plain text
A futuristic city marketplace filled with flying vehicles, holographic signs, dense crowds, neon lighting, cinematic realism, ultra-detailed, high-information-density composition
```


Recommended elements:

- Main subject
- Scene or environment
- Visual style
- Lighting
- Camera angle
- Composition
- Detail level
- Quality requirements

---


## For Image-to-Image


When editing an existing image, clearly specify both the transformation and the preservation requirements.


Good example:


```plain text
Convert the image into a fantasy winter landscape, add snow, warm window lights, and a magical atmosphere, while preserving the original building structure and camera angle.
```


Recommended structure:


```plain text
[Change requirement] + [New style / scene] + [Elements to add or remove] + [Elements to preserve]
```


Example:


```plain text
Change the daytime street scene into a cinematic cyberpunk night scene, add neon signs and wet road reflections, while preserving the original street layout, camera angle, and main building shapes.
```


---


## For High-Information-Density Images


Agnes Image 2.1 Flash is optimized for complex and detail-rich visuals. For best results, describe the visual hierarchy clearly.


Recommended elements:

- Main subject
- Background environment
- Important secondary details
- Style and lighting
- Composition constraints
- What should remain unchanged, if using image-to-image

Good example:


```plain text
A large fantasy harbor city built on cliffs, hundreds of small boats, layered stone bridges, glowing windows, distant mountains, cloudy sunset sky, cinematic fantasy realism, wide-angle composition, rich architectural details, high visual density
```


---


# Common Errors and Troubleshooting


## 1. `response_format` at the Top Level Causes an Error


Do not put `response_format` at the top level.


Incorrect:


```json
{
  "model": "agnes-image-2.1-flash",
  "prompt": "A futuristic city",
  "size": "1024x768",
  "response_format": "url"
}
```


Correct:


```json
{
  "model": "agnes-image-2.1-flash",
  "prompt": "A futuristic city",
  "size": "1024x768",
  "extra_body": {
    "response_format": "url"
  }
}
```


---


## 2. Image-to-Image Does Not Require `tags`


Do not pass:


```json
{
  "tags": ["img2img"]
}
```


For image-to-image, only provide the input image in the `image` array.


Correct:


```json
{
  "model": "agnes-image-2.1-flash",
  "prompt": "Make the object blue while preserving the original composition",
  "size": "1024x768",
  "extra_body": {
    "image": [
    "https://example.com/input.png"
  ],
    "response_format": "url"
  }
}
```


---


## 3. Input Image URL Is Not Accessible


If the input image URL cannot be accessed by the server, the request may fail.


Recommended solutions:

- Use a public HTTPS image URL.
- Make sure the image URL does not require login, cookies, or private headers.
- Use Data URI Base64 input if the image cannot be publicly accessed.

---


## 4. Request Timeout


Image generation may take several seconds to tens of seconds depending on the prompt complexity, image size, and server load.


Recommended client timeout:


```plain text
60s to 360s
```


---


## 5. Missing `image` in Image-to-Image Requests


For image-to-image generation, the `image` array is required.


Incorrect:


```json
{
  "model": "agnes-image-2.1-flash",
  "prompt": "Make the image cyberpunk style",
  "size": "1024x768"
}
```


Correct:


```json
{
  "model": "agnes-image-2.1-flash",
  "prompt": "Make the image cyberpunk style while preserving the original composition",
  "size": "1024x768",
  "extra_body": {
    "image": [
    "https://example.com/input.png"
  ],
    "response_format": "url"
  }
}
```


---


# Pricing


| Type             | Price            |
| ---------------- | ---------------- |
| Generated Images | 0 $0.003 / image |


---


# Notes

- Use `agnes-image-2.1-flash` as the model name.
- Use `https://apihub.agnes-ai.com/v1/images/generations` as the API endpoint.
- For text-to-image generation, `model`, `prompt`, and `size` are required.
- For image-to-image generation, provide the input image URL or Data URI Base64 under the top-level `image` array.
- Use `extra_body.response_format: "url"` when you want the generated result returned as an image URL.
- Use `return_base64: true` for text-to-image Base64 output.
- Use `extra_body.response_format: "b64_json"` for image-to-image Base64 output.
- Do not put `response_format` at the top level.
- Do not pass `tags: ["img2img"]`.
- Do not expose temporary API keys in public documentation. Use `YOUR_API_KEY` in all public examples.
