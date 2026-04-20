<script>
  import BaseModal from './base_modal.svelte'

  /** @type {{
   *   open?: boolean,
   *   title?: string,
   *   message?: string,
   *   buttonLabel?: string,
   *   onclose?: (() => void) | undefined,
   * }}
   */
  let {
    open = false,
    title = 'Alert',
    message = '',
    buttonLabel = 'OK',
    onclose = undefined,
  } = $props()
</script>

<BaseModal {open} {title} {message} closeLabel={buttonLabel} {onclose} />
