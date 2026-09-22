#!/bin/sh
set -eu

# The build inlined a __NAME__ sentinel for every NEXT_PUBLIC_ variable (see the
# Dockerfile), because Next bakes those into the bundle and cannot read them
# from the environment afterwards. Swap in whatever this container was given.

script=""
for key in $(printenv | sed -n 's/^\(NEXT_PUBLIC_[A-Za-z0-9_]*\)=.*$/\1/p'); do
    # printenv, not the cut-on-"=" trick: values may contain "=".
    value=$(printenv "$key" || true)
    # "|" is the delimiter, "&" and "\" are special on the right-hand side.
    value=$(printf '%s' "$value" | sed -e 's/[\\&|]/\\&/g')
    script="${script}s|__${key}__|${value}|g;"
done

if [ -n "$script" ]; then
    # Server chunks and client chunks both carry sentinels; only the files that
    # actually contain one are rewritten.
    grep -rl '__NEXT_PUBLIC_' .next public 2>/dev/null | while IFS= read -r file; do
        sed -i "$script" "$file"
    done
fi

# Anything still unresolved would ship a literal "__NEXT_PUBLIC_…__" to the
# browser, which is far harder to read from a blank screen than a line here.
missing=$(grep -rho '__NEXT_PUBLIC_[A-Za-z0-9_]*__' .next 2>/dev/null | sort -u || true)
if [ -n "$missing" ]; then
    echo "entrypoint: no value given for:" >&2
    echo "$missing" | sed 's/^__\(.*\)__$/  \1/' >&2
fi

# Execute the container's main process (CMD in the Dockerfile).
exec "$@"
