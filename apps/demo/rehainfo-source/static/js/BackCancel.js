"use strict";
// 戻るボタンキャンセル処理
// 画面遷移後に一度もユーザーが能動的にアクション(マウスクリックやキーボード入力)を起こさない場合
// 戻るボタンが有効となっている(Chromeの仕様による)
$(function (){
    //# 初回pushState
    // AutoSaveManager Integration: If AutoSaveManager is present, DO NOT push state here.
    // AutoSaveManager will handle its own pushState. Doing it twice creates a "Double Trap"
    // that breaks history.go(-2) logic for Discard action.
    if (typeof AutoSaveManager !== 'undefined') {
        console.log("BackCancel.js: AutoSaveManager detected. Skipping initial pushState.");
        return;
    }

    history.pushState(null, null, null);
    console.log("## document.ready fired ## => history.pushState was executed");

    window.addEventListener("popstate",function (){

        if (location.href.indexOf('#') > 0){
            return;
        }
        history.pushState(null, null, null);

        this.alert("ブラウザバックは利用しないでください。");
    });
});
