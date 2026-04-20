<script>
  import LoginButton from '../../components/button/login_button.svelte'

  const handleLoginTest = () => {
    console.log('login button test')
  }
</script>

<main class="login-page">
  <LoginButton label="login" onclick={handleLoginTest} />
</main>

<style>
  .login-page {
    width: min(100%, 360px);
    margin: 80px auto;
    padding: 0 20px;
  }
</style>
