<?php

namespace App\Rules;

use Closure;
use DOMDocument;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Http\UploadedFile;
use Illuminate\Translation\PotentiallyTranslatedString;

class SafeSvg implements ValidationRule
{
    /**
     * Run the validation rule.
     *
     * @param  Closure(string, ?string=): PotentiallyTranslatedString  $fail
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! $value instanceof UploadedFile || strtolower($value->getClientOriginalExtension()) !== 'svg') {
            return;
        }

        $contents = file_get_contents($value->getRealPath());

        if ($contents === false || str_contains(strtoupper($contents), '<!DOCTYPE') || str_contains(strtoupper($contents), '<!ENTITY')) {
            $fail('The :attribute must be a safe SVG image.');

            return;
        }

        $previousLibxmlSetting = libxml_use_internal_errors(true);
        $document = new DOMDocument;
        $loaded = $document->loadXML(
            $contents,
            LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING | LIBXML_COMPACT,
        );
        libxml_clear_errors();
        libxml_use_internal_errors($previousLibxmlSetting);

        if (! $loaded || strtolower($document->documentElement->localName) !== 'svg') {
            $fail('The :attribute must be a valid SVG image.');

            return;
        }

        $blockedElements = [
            'script', 'foreignobject', 'iframe', 'object', 'embed', 'audio',
            'video', 'image', 'animate', 'animatemotion', 'animatetransform',
            'set',
        ];

        foreach ($document->getElementsByTagName('*') as $element) {
            if (in_array(strtolower($element->localName), $blockedElements, true)) {
                $fail('The :attribute contains unsafe SVG content.');

                return;
            }

            foreach ($element->attributes as $attributeNode) {
                $name = strtolower($attributeNode->nodeName);
                $attributeValue = trim($attributeNode->nodeValue ?? '');

                if (str_starts_with($name, 'on') || $name === 'xml:base') {
                    $fail('The :attribute contains unsafe SVG attributes.');

                    return;
                }

                if (str_ends_with($name, 'href') && $attributeValue !== '' && ! str_starts_with($attributeValue, '#')) {
                    $fail('The :attribute may not reference external resources.');

                    return;
                }

                if ($this->containsUnsafeCssOrProtocol($attributeValue)) {
                    $fail('The :attribute contains unsafe SVG values.');

                    return;
                }
            }

            if (strtolower($element->localName) === 'style'
                && $this->containsUnsafeCssOrProtocol($element->textContent)) {
                $fail('The :attribute contains unsafe SVG styles.');

                return;
            }
        }
    }

    private function containsUnsafeCssOrProtocol(string $value): bool
    {
        return preg_match('/(?:javascript|vbscript|data):|@import|expression\s*\(|url\s*\(\s*[\'\"]?(?!#)/i', $value) === 1;
    }
}
