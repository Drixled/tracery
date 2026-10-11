<script lang="ts">
	import { Toaster as Sonner, type ToasterProps as SonnerProps } from "svelte-sonner";
	import ArrowPathIcon from '~icons/heroicons/arrow-path-16-solid';
	import CheckCircleIcon from '~icons/heroicons/check-circle-16-solid';
	import XCircleIcon from '~icons/heroicons/x-circle-16-solid';
	import InfoIcon from '~icons/heroicons/information-circle-16-solid';
	import ExclamationTriangleIcon from '~icons/heroicons/exclamation-triangle-16-solid';

	let { ...restProps }: SonnerProps = $props();
</script>

<Sonner
	theme="dark"
	class="toaster group"
	style="--normal-bg: var(--color-popover); --normal-text: var(--color-popover-foreground); --normal-border: var(--color-border);"
	toastOptions={{
		classes: {
			toast: "cn-toast",
		},
	}}
	{...restProps}
>
	{#snippet loadingIcon()}
		<ArrowPathIcon class="size-4 animate-spin" />
	{/snippet}
	{#snippet successIcon()}
		<CheckCircleIcon class="size-4" />
	{/snippet}
	{#snippet errorIcon()}
		<XCircleIcon class="size-4" />
	{/snippet}
	{#snippet infoIcon()}
		<InfoIcon class="size-4" />
	{/snippet}
	{#snippet warningIcon()}
		<ExclamationTriangleIcon class="size-4" />
	{/snippet}
</Sonner>
